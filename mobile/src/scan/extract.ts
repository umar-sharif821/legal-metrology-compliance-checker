/**
 * The extraction cascade — OCR lines in, declared field values out.
 *
 * Three stages, tried in order of how much evidence each one rests on. This mirrors
 * plan §7.2, at demo scale:
 *
 *   A  anchor and value on the same line               → high confidence
 *   B  anchor and value in the same region of the label → medium confidence
 *   C  no anchor at all, value recognised by shape      → low confidence
 *
 * Stage C only runs for fields the pack marks `unanchored_recovery`, because only some
 * shapes are distinctive enough to stand alone. `₹45.00` is unmistakably a price;
 * a line of free text is not unmistakably an address.
 *
 * The stage and confidence travel with the value all the way to the screen. A finding
 * that rests on stage C says so (P9), and the evaluator never lets one hide behind a
 * stage-A presentation.
 *
 * This module is pure: same lines in, same fields out, no clock, no I/O, no randomness.
 */

import type { CompiledField, CompiledPack, SpatialAssociation } from '../rulepack/pack';
import { associate, type Candidate } from './associate';
import { findAnchorEnd, normaliseLines, stripLeadingSeparators } from './normalise';
import type {
  Association,
  Box,
  Confidence,
  ExtractedField,
  ExtractionResult,
  ExtractionStage,
  OcrLine,
} from './types';

const CONFIDENCE_BY_STAGE: Readonly<Record<ExtractionStage, Confidence>> = {
  A_anchored_inline: 'high',
  B_anchored_adjacent: 'medium',
  C_shape_only: 'low',
};

/** Smallest box containing all of the given boxes. Null if none had geometry. */
function unionBox(boxes: readonly (Box | null)[]): Box | null {
  const present = boxes.filter((b): b is Box => b !== null);
  if (present.length === 0) return null;
  const left = Math.min(...present.map((b) => b.x));
  const top = Math.min(...present.map((b) => b.y));
  const right = Math.max(...present.map((b) => b.x + b.width));
  const bottom = Math.max(...present.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Is `candidate` anywhere other than *above* `anchor` on the label?
 *
 * The reading-order fallback's only geometric test, and the weakest one that is still
 * true by definition: the candidate's bottom edge must fall below the anchor's top edge.
 * With no box for either line the answer is `true` — degrade to pure list order rather
 * than refusing to extract at all (P9; the stage and confidence still say how the value
 * was found, and `association: null` says geometry was not what chose it).
 */
function isNotAbove(anchorBox: Box | null, candidateBox: Box | null): boolean {
  if (anchorBox === null || candidateBox === null) return true;
  return candidateBox.y + candidateBox.height > anchorBox.y;
}

/**
 * The matched slice of `text`, or null.
 *
 * The **whole** match is returned, never a capture group. Groups exist in these shapes
 * to express alternation, not to name the value: `month_year` captures the month in
 * group 1, so returning the first group would turn `nov 2026` into `nov`. The value a
 * person needs to read is the span the shape matched.
 */
function shapeMatch(re: RegExp, text: string): string | null {
  return re.exec(text)?.[0] ?? null;
}

/**
 * Choose what to show as the value.
 *
 * A shape match locates a declaration; it is not always the declaration. On an address
 * the shape recognises a PIN code, but showing an officer `400703` where they expected
 * a manufacturer is useless — the pack says `whole_line` for that field and the whole
 * source line is shown instead. Either way the match is what *found* the field; this
 * only decides what a human is shown (P7).
 */
function present(field: CompiledField, captured: string, sourceLine: string): string {
  return field.valuePresentation === 'whole_line' ? sourceLine : captured;
}

function make(
  field: CompiledField,
  value: string,
  lineIndexes: readonly number[],
  lines: readonly OcrLine[],
  normalised: readonly string[],
  stage: ExtractionStage,
  association: Association | null = null,
): ExtractedField {
  return {
    fieldId: field.id,
    value: value.trim(),
    sourceText: lineIndexes.map((i) => normalised[i]).join(' '),
    lineIndexes,
    box: unionBox(lineIndexes.map((i) => lines[i]?.box ?? null)),
    stage,
    confidence: CONFIDENCE_BY_STAGE[stage],
    association,
  };
}

/**
 * Stage B by geometry — the `A-4` path.
 *
 * Offers every line except the anchor's own to `associate`, which decides by where the
 * boxes sit rather than by how far apart the two entries are in the OCR list. A line is
 * offered only if it could carry the value at all: non-empty, geometry present, and — for
 * a field that declares a shape — matching the loose anchored shape.
 *
 * The field's `value_may_span_lines` is what becomes the downward reach. It is a count of
 * text rows in the pack, and a row's pitch is a little over its glyph height, so the two
 * are converted with `row_pitch_heights`. The number stays where it was and keeps meaning
 * what it meant; only the unit it is measured in changed, from list entries to label
 * geometry. Sideways reach is not per-field — a value printed beside its label is on the
 * same row whatever kind of declaration it is.
 *
 * Returns null when the anchor has no box (the caller then falls back to reading order),
 * and also when the geometry simply did not answer — see `associate` on why refusing is
 * the right output there.
 */
function stageBByGeometry(
  field: CompiledField,
  anchorIndex: number,
  anchoredShape: CompiledField['shape'],
  lines: readonly OcrLine[],
  normalised: readonly string[],
  cfg: SpatialAssociation,
): ExtractedField | null {
  const anchorBox = lines[anchorIndex]?.box ?? null;
  if (anchorBox === null) return null;

  const captured = new Map<number, string>();
  const candidates: Candidate[] = [];
  for (let j = 0; j < normalised.length; j++) {
    if (j === anchorIndex) continue;
    const text = normalised[j];
    if (text.length === 0) continue;
    const box = lines[j]?.box ?? null;
    if (box === null) continue;

    if (anchoredShape) {
      const hit = shapeMatch(anchoredShape.re, text);
      if (hit === null) continue;
      captured.set(j, hit);
    }
    candidates.push({
      index: j,
      box,
      // A candidate that clears the field's strict shape as well as the loose one is
      // better evidence. With no strict shape to clear, every candidate scores the same
      // here and the choice is left to geometry alone.
      matchesStrictShape: field.shape !== null && field.shape.re.test(text),
    });
  }

  const reach = Math.max(1, field.valueMaySpanLines) * cfg.rowPitchHeights;
  const chosen = associate(anchorBox, candidates, reach, cfg);
  if (chosen === null) return null;

  const j = chosen.candidate.index;
  const value = anchoredShape
    ? present(field, captured.get(j) ?? '', normalised[j])
    : normalised[j];
  if (value.length === 0) return null;

  return make(
    field,
    value,
    [anchorIndex, j],
    lines,
    normalised,
    'B_anchored_adjacent',
    chosen.association,
  );
}

/**
 * Stage B by reading order — the pre-`A-4` behaviour, kept as the degraded path.
 *
 * Used only when the engine gave the anchor line no bounding box, which is the one case
 * where geometry cannot be consulted. Pairing by list index is what `A-4` exists to
 * replace, so this is a fallback and never a first choice; the field it produces carries
 * `association: null`, which is how a reader tells the two apart (P9).
 */
function stageBByReadingOrder(
  field: CompiledField,
  anchorIndex: number,
  anchoredShape: CompiledField['shape'],
  lines: readonly OcrLine[],
  normalised: readonly string[],
): ExtractedField | null {
  const span = Math.max(1, field.valueMaySpanLines);
  for (let k = 1; k <= span && anchorIndex + k < normalised.length; k++) {
    const j = anchorIndex + k;
    const below = normalised[j];
    if (below.length === 0) continue;
    if (!isNotAbove(lines[anchorIndex]?.box ?? null, lines[j]?.box ?? null)) continue;
    if (anchoredShape) {
      const hit = shapeMatch(anchoredShape.re, below);
      if (hit !== null) {
        return make(
          field,
          present(field, hit, below),
          [anchorIndex, j],
          lines,
          normalised,
          'B_anchored_adjacent',
        );
      }
    } else {
      return make(field, below, [anchorIndex, j], lines, normalised, 'B_anchored_adjacent');
    }
  }
  return null;
}

/**
 * Try to recover one field from the normalised lines.
 *
 * Returns the first hit, scanning top to bottom. On a label the declarations appear
 * once; taking the first is both correct and cheap. Where two candidates genuinely
 * compete *for the same anchor*, `associate` resolves the contest by geometry or refuses;
 * two separate anchors on one label are still settled by the upper one winning.
 */
function extractField(
  field: CompiledField,
  lines: readonly OcrLine[],
  normalised: readonly string[],
  cfg: SpatialAssociation,
): ExtractedField | null {
  // Stages A and B run after an anchor has already established what the line is
  // about, so they may use the looser shape. Stage C has no such warrant and must use
  // the strict one.
  const anchoredShape = field.anchoredShape ?? field.shape;

  // ---- Stage A: anchor and value on the same line -------------------------
  for (let i = 0; i < normalised.length; i++) {
    const anchorEnd = findAnchorEnd(normalised[i], field.anchors);
    if (anchorEnd === -1) continue;

    const rest = stripLeadingSeparators(normalised[i].slice(anchorEnd));
    if (field.anchorRemainderIsValue || !anchoredShape) {
      // A free-text declaration: the anchor has already done the identifying, so
      // whatever follows it on the line is the value. No shape is consulted.
      if (rest.length > 0) {
        return make(field, rest, [i], lines, normalised, 'A_anchored_inline');
      }
    } else {
      const hit = shapeMatch(anchoredShape.re, rest);
      if (hit !== null) {
        return make(field, present(field, hit, rest), [i], lines, normalised, 'A_anchored_inline');
      }
    }

    // ---- Stage B: anchor here, value somewhere around it ------------------
    const spatial = stageBByGeometry(field, i, anchoredShape, lines, normalised, cfg);
    if (spatial !== null) return spatial;
    if ((lines[i]?.box ?? null) === null) {
      const ordered = stageBByReadingOrder(field, i, anchoredShape, lines, normalised);
      if (ordered !== null) return ordered;
    }
    // Anchor seen but no value found near it. Keep scanning: the label may repeat the
    // anchor somewhere more useful.
  }

  // ---- Stage C: no anchor anywhere, shape alone ---------------------------
  if (field.unanchoredRecovery && field.shape) {
    for (let i = 0; i < normalised.length; i++) {
      const hit = shapeMatch(field.shape.re, normalised[i]);
      if (hit !== null) {
        return make(
          field,
          present(field, hit, normalised[i]),
          [i],
          lines,
          normalised,
          'C_shape_only',
        );
      }
    }
  }

  return null;
}

/** Run the cascade for every field the pack declares. */
export function extract(pack: CompiledPack, lines: readonly OcrLine[]): ExtractionResult {
  const startedAt = Date.now();
  const normalised = normaliseLines(lines.map((l) => l.text));

  const fields: ExtractedField[] = [];
  for (const field of pack.fields) {
    const found = extractField(field, lines, normalised, pack.metadata.association);
    if (found) fields.push(found);
  }

  return {
    fields,
    normalisedLines: normalised,
    normalisedText: normalised.join('\n'),
    extractMs: Date.now() - startedAt,
  };
}
