/**
 * The extraction cascade — OCR lines in, declared field values out.
 *
 * Three stages, tried in order of how much evidence each one rests on. This mirrors
 * plan §7.2, at demo scale:
 *
 *   A  anchor and value on the same line          → high confidence
 *   B  anchor on one line, value just below it    → medium confidence
 *   C  no anchor at all, value recognised by shape → low confidence
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

import type { CompiledField, CompiledPack } from '../rulepack/pack';
import { findAnchorEnd, normaliseLines, stripLeadingSeparators } from './normalise';
import type {
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
): ExtractedField {
  return {
    fieldId: field.id,
    value: value.trim(),
    sourceText: lineIndexes.map((i) => normalised[i]).join(' '),
    lineIndexes,
    box: unionBox(lineIndexes.map((i) => lines[i]?.box ?? null)),
    stage,
    confidence: CONFIDENCE_BY_STAGE[stage],
  };
}

/**
 * Try to recover one field from the normalised lines.
 *
 * Returns the first hit, scanning top to bottom. On a label the declarations appear
 * once; taking the first is both correct and cheap. Where two candidates genuinely
 * compete (two prices on a promotional pack) this picks the upper one and marks its
 * stage — resolving that contest properly is `T-2.3`, not demo work.
 */
function extractField(
  field: CompiledField,
  lines: readonly OcrLine[],
  normalised: readonly string[],
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

    // ---- Stage B: anchor here, value on the lines below -------------------
    const span = Math.max(1, field.valueMaySpanLines);
    for (let k = 1; k <= span && i + k < normalised.length; k++) {
      const below = normalised[i + k];
      if (below.length === 0) continue;
      if (anchoredShape) {
        const hit = shapeMatch(anchoredShape.re, below);
        if (hit !== null) {
          return make(
            field,
            present(field, hit, below),
            [i, i + k],
            lines,
            normalised,
            'B_anchored_adjacent',
          );
        }
      } else {
        return make(field, below, [i, i + k], lines, normalised, 'B_anchored_adjacent');
      }
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
    const found = extractField(field, lines, normalised);
    if (found) fields.push(found);
  }

  return {
    fields,
    normalisedLines: normalised,
    normalisedText: normalised.join('\n'),
    extractMs: Date.now() - startedAt,
  };
}
