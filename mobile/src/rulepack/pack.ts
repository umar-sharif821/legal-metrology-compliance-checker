/**
 * Rule-pack loader and interpreter vocabulary.
 *
 * The pack is data; this file is the interpreter's view of it (P6). Nothing statutory
 * is written here — no clause number, no unit, no anchor term, no threshold. If you
 * find yourself typing one, it belongs in `demo-lmpc-v0.json`.
 *
 * Loading is a validating parse, not a cast. A malformed pack throws at startup rather
 * than producing a quietly wrong verdict.
 */

import rawPack from './demo-lmpc-v0.json';

// ---------------------------------------------------------------------------
// Closed vocabularies. Adding a member here is a deliberate change that must be
// made together with the evaluator's switch — the compiler enforces that.
// ---------------------------------------------------------------------------

export type Severity = 'advisory' | 'violation';
export type ProvenanceStatus = 'PENDING_LEGAL_REVIEW' | 'DISPUTED' | 'REVIEWED';
export type CheckKind = 'field_present' | 'value_wellformed' | 'context_phrase_present';

/**
 * How an extracted value should be shown to the officer.
 *
 * `captured` shows only what the shape matched — `₹45.00`, `200 g`. `whole_line` shows
 * the entire source line, which is what a free-text declaration needs: on an address the
 * shape recognises the PIN code, but the address is what a person has to read.
 */
export type ValuePresentation = 'captured' | 'whole_line';

export interface CompiledShape {
  readonly id: string;
  readonly description: string;
  /** Non-global. Use `.test()` / `.exec()` freely; there is no `lastIndex` to reset. */
  readonly re: RegExp;
}

export interface CompiledField {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  /** Anchor terms, already normalised and sorted longest-first so greedy match wins. */
  readonly anchors: readonly string[];
  /** The strict shape. Used for unanchored (stage C) recovery and by checks. */
  readonly shape: CompiledShape | null;
  /**
   * A looser shape used only once an anchor has already identified the line.
   *
   * This is what lets the evaluator distinguish *absent* from *malformed*. If the only
   * shape were the strict one, `Net Qty: 250` with no unit would fail to extract and be
   * reported as a missing declaration — when in fact the declaration is present and
   * defective, which is a different finding under a different reading of the rule.
   * Null means the strict shape is used at every stage.
   */
  readonly anchoredShape: CompiledShape | null;
  /** May this field be recovered from shape alone, with no anchor present? */
  readonly unanchoredRecovery: boolean;
  /** How many lines below the anchor the value may be found on. */
  readonly valueMaySpanLines: number;
  readonly valuePresentation: ValuePresentation;
  /**
   * For a free-text declaration, whatever follows the anchor on its line *is* the value.
   *
   * `Mfd. by: Parle Products Pvt. Ltd.` declares the manufacturer on that line. A shape
   * cannot recognise a company name, so requiring one here would push the extractor
   * past the answer and onto the address line below it. The shape is still used on the
   * following lines when the anchor's own line ends bare (`Marketed by` / newline).
   */
  readonly anchorRemainderIsValue: boolean;
}

export type CompiledCheck =
  | { readonly kind: 'field_present' }
  | { readonly kind: 'value_wellformed'; readonly shape: CompiledShape }
  | {
      readonly kind: 'context_phrase_present';
      readonly anyOf: readonly string[];
      /**
       * May this check fail on a field that was recovered by shape alone (stage C)?
       *
       * When true it may not: with no anchor read, the scan has no warrant to claim the
       * qualifying wording is absent, and the check is skipped instead. See the check's
       * own note in the pack for the D-3 measurement behind it.
       */
      readonly requiresAnchoredField: boolean;
    };

export interface AlternateReading {
  readonly subClause: string;
  readonly source: string;
  readonly note: string;
}

export interface Clause {
  readonly rule: string;
  readonly subClause: string;
  readonly verification: string;
  readonly alternateReadings: readonly AlternateReading[];
  readonly note: string;
  /** True when the sub-clause letter itself is disputed — the UI must show the contest. */
  readonly contested: boolean;
}

export interface CompiledDeclaration {
  readonly id: string;
  readonly fieldId: string;
  readonly check: CompiledCheck;
  readonly clause: Clause;
  readonly title: string;
  readonly requirement: string;
  readonly remedy: string;
  /** Already capped against the pack's provenance status — see `capSeverity`. */
  readonly severityIfFailed: Severity;
}

/**
 * Stage B's geometry, as the interpreter sees it.
 *
 * Method parameters, not statutory values — the pack's own note says so, and nothing here
 * may be cited as law. They live in the pack because tuning them against the gold set must
 * be a data change, not a code change (P6). Distances are in multiples of the anchor's own
 * text height; see `scan/associate.ts` for what each one gates.
 */
export interface SpatialAssociation {
  /** Horizontal reach to the right of an anchor, in anchor heights. */
  readonly maxRightGapHeights: number;
  /** How far two boxes' vertical centres may drift and still count as one row. */
  readonly maxRowDriftHeights: number;
  /** A text row's pitch relative to its glyph height — converts "lines" into distance. */
  readonly rowPitchHeights: number;
  /** Least share of the narrower box's width two stacked boxes must have in common. */
  readonly minColumnOverlap: number;
  readonly proximityWeight: number;
  readonly shapeStrengthWeight: number;
  /** Absolute floor a winning candidate must clear. */
  readonly minScore: number;
  /** How far ahead of the runner-up the winner must be, or the answer is nothing (P3). */
  readonly minMargin: number;
}

export interface PackMetadata {
  readonly packId: string;
  readonly packVersion: string;
  readonly statuteCode: string;
  readonly statuteLong: string;
  readonly jurisdiction: string;
  readonly scopeNote: string;
  readonly provenanceStatus: ProvenanceStatus;
  readonly provenanceNote: string;
  readonly demoOnly: boolean;
  readonly minOcrLines: number;
  readonly minFieldsFound: number;
  readonly association: SpatialAssociation;
}

export interface CompiledPack {
  readonly metadata: PackMetadata;
  readonly fields: readonly CompiledField[];
  readonly declarations: readonly CompiledDeclaration[];
  fieldById(id: string): CompiledField | undefined;
}

// ---------------------------------------------------------------------------
// Validating parse
// ---------------------------------------------------------------------------

class PackError extends Error {
  constructor(where: string, detail: string) {
    super(`rule pack is invalid at ${where}: ${detail}`);
    this.name = 'PackError';
  }
}

function str(v: unknown, where: string): string {
  if (typeof v !== 'string') throw new PackError(where, `expected a string, got ${typeof v}`);
  return v;
}

function num(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new PackError(where, `expected a finite number, got ${String(v)}`);
  }
  return v;
}

function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new PackError(where, 'expected an array');
  return v;
}

function obj(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new PackError(where, 'expected an object');
  }
  return v as Record<string, unknown>;
}

const PROVENANCE_STATUSES: readonly string[] = ['PENDING_LEGAL_REVIEW', 'DISPUTED', 'REVIEWED'];

/**
 * The advisory-only invariant, enforced at runtime rather than trusted.
 *
 * Only a `REVIEWED` pack may emit a `violation`. Everything else is capped at
 * `advisory` no matter what the declaration asks for. This mirrors the structural
 * guarantee the real schema makes (`max_severity` refused unless `REVIEWED`) so the
 * demo cannot drift from the project's rule while using a looser pack format.
 */
export function capSeverity(requested: string, status: ProvenanceStatus): Severity {
  if (requested !== 'violation' && requested !== 'advisory') {
    throw new PackError('declaration.severity_if_failed', `unknown severity '${requested}'`);
  }
  return status === 'REVIEWED' ? requested : 'advisory';
}

/**
 * Read Stage B's geometry out of the pack.
 *
 * Every value is required — there is no default in this file. A pack that omits one is
 * refused at startup rather than silently picking a number here, which is the same rule
 * the rest of the loader follows and the reason none of these thresholds can drift into
 * code (P6). The bounds are the ones that make the parameter meaningful at all: a
 * negative reach, an overlap outside 0–1, or two zero weights would each make the
 * association step incoherent rather than merely badly tuned.
 */
function compileAssociation(o: Record<string, unknown>): SpatialAssociation {
  const where = 'metadata.spatial_association';
  const at = (key: string, lo: number, hi: number): number => {
    const v = num(o[key], `${where}.${key}`);
    if (v < lo || v > hi) {
      throw new PackError(`${where}.${key}`, `expected a number in [${lo}, ${hi}], got ${v}`);
    }
    return v;
  };
  const proximityWeight = at('proximity_weight', 0, 1);
  const shapeStrengthWeight = at('shape_strength_weight', 0, 1);
  if (proximityWeight + shapeStrengthWeight <= 0) {
    throw new PackError(where, 'proximity_weight and shape_strength_weight cannot both be zero');
  }
  return {
    maxRightGapHeights: at('max_right_gap_heights', 0, 100),
    maxRowDriftHeights: at('max_row_drift_heights', 0, 100),
    rowPitchHeights: at('row_pitch_heights', 0, 100),
    minColumnOverlap: at('min_column_overlap', 0, 1),
    proximityWeight,
    shapeStrengthWeight,
    minScore: at('min_score', 0, 1),
    minMargin: at('min_margin', 0, 1),
  };
}

function parsePresentation(v: unknown, where: string): ValuePresentation {
  const p = str(v, where);
  if (p !== 'captured' && p !== 'whole_line') {
    throw new PackError(where, `unknown value presentation '${p}'`);
  }
  return p;
}

function compileShape(id: string, rawShape: unknown): CompiledShape {
  const o = obj(rawShape, `shapes.${id}`);
  const pattern = str(o.pattern, `shapes.${id}.pattern`);
  const flags = str(o.flags, `shapes.${id}.flags`);
  if (flags.includes('g')) {
    // A global regex carries mutable `lastIndex`, which makes `.test()` alternate
    // between true and false across calls. That is a determinism bug (P1), so it is
    // refused rather than silently stripped.
    throw new PackError(`shapes.${id}.flags`, "the 'g' flag is not allowed on a shape");
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    throw new PackError(`shapes.${id}.pattern`, `does not compile: ${String(e)}`);
  }
  return { id, description: str(o.description, `shapes.${id}.description`), re };
}

function compileClause(rawClause: unknown, where: string): Clause {
  const o = obj(rawClause, where);
  const alternates = arr(o.alternate_readings, `${where}.alternate_readings`).map((a, i) => {
    const ao = obj(a, `${where}.alternate_readings[${i}]`);
    return {
      subClause: str(ao.sub_clause, `${where}.alternate_readings[${i}].sub_clause`),
      source: str(ao.source, `${where}.alternate_readings[${i}].source`),
      note: str(ao.note, `${where}.alternate_readings[${i}].note`),
    };
  });
  return {
    rule: str(o.rule, `${where}.rule`),
    subClause: str(o.sub_clause, `${where}.sub_clause`),
    verification: str(o.verification, `${where}.verification`),
    alternateReadings: alternates,
    note: str(o.note, `${where}.note`),
    contested: alternates.length > 0,
  };
}

function compileCheck(
  rawCheck: unknown,
  shapes: ReadonlyMap<string, CompiledShape>,
  where: string,
): CompiledCheck {
  const o = obj(rawCheck, where);
  const kind = str(o.kind, `${where}.kind`);
  switch (kind) {
    case 'field_present':
      return { kind: 'field_present' };
    case 'value_wellformed': {
      const shapeId = str(o.shape, `${where}.shape`);
      const shape = shapes.get(shapeId);
      if (!shape) throw new PackError(`${where}.shape`, `unknown shape '${shapeId}'`);
      return { kind: 'value_wellformed', shape };
    }
    case 'context_phrase_present': {
      const phrases = arr(o.any_of, `${where}.any_of`).map((p, i) =>
        str(p, `${where}.any_of[${i}]`).toLowerCase(),
      );
      if (phrases.length === 0) throw new PackError(`${where}.any_of`, 'must not be empty');
      return {
        kind: 'context_phrase_present',
        anyOf: phrases,
        requiresAnchoredField: o.requires_anchored_field === true,
      };
    }
    default:
      throw new PackError(`${where}.kind`, `unknown check kind '${kind}'`);
  }
}

function compile(raw: unknown): CompiledPack {
  const root = obj(raw, '<root>');
  const meta = obj(root.metadata, 'metadata');
  const prov = obj(meta.provenance, 'metadata.provenance');
  const thresholds = obj(meta.evidence_thresholds, 'metadata.evidence_thresholds');
  const assoc = obj(meta.spatial_association, 'metadata.spatial_association');

  const status = str(prov.status, 'metadata.provenance.status');
  if (!PROVENANCE_STATUSES.includes(status)) {
    throw new PackError('metadata.provenance.status', `unknown status '${status}'`);
  }
  const provenanceStatus = status as ProvenanceStatus;

  const metadata: PackMetadata = {
    packId: str(meta.pack_id, 'metadata.pack_id'),
    packVersion: str(meta.pack_version, 'metadata.pack_version'),
    statuteCode: str(meta.statute_code, 'metadata.statute_code'),
    statuteLong: str(meta.statute_long, 'metadata.statute_long'),
    jurisdiction: str(meta.jurisdiction, 'metadata.jurisdiction'),
    scopeNote: str(meta.scope_note, 'metadata.scope_note'),
    provenanceStatus,
    provenanceNote: str(prov.note, 'metadata.provenance.note'),
    demoOnly: meta.demo_only === true,
    minOcrLines: num(thresholds.min_ocr_lines, 'metadata.evidence_thresholds.min_ocr_lines'),
    minFieldsFound: num(
      thresholds.min_fields_found,
      'metadata.evidence_thresholds.min_fields_found',
    ),
    association: compileAssociation(assoc),
  };

  const shapes = new Map<string, CompiledShape>();
  for (const [id, rawShape] of Object.entries(obj(root.shapes, 'shapes'))) {
    shapes.set(id, compileShape(id, rawShape));
  }

  const lexicons = obj(root.lexicons, 'lexicons');

  const fields: CompiledField[] = arr(root.fields, 'fields').map((f, i) => {
    const o = obj(f, `fields[${i}]`);
    const id = str(o.id, `fields[${i}].id`);
    const anchorsRef = str(o.anchors_ref, `fields[${i}].anchors_ref`);
    const rawAnchors = lexicons[anchorsRef];
    if (rawAnchors === undefined) {
      throw new PackError(`fields[${i}].anchors_ref`, `unknown lexicon '${anchorsRef}'`);
    }
    const anchors = arr(rawAnchors, `lexicons.${anchorsRef}`)
      .map((a, j) => str(a, `lexicons.${anchorsRef}[${j}]`).toLowerCase())
      // Longest first: "net quantity" must win over "quantity" on the same line.
      .sort((a, b) => b.length - a.length);

    const resolveShape = (key: string): CompiledShape | null => {
      const v = o[key];
      if (v === null || v === undefined) return null;
      const shapeId = str(v, `fields[${i}].${key}`);
      const found = shapes.get(shapeId);
      if (!found) throw new PackError(`fields[${i}].${key}`, `unknown shape '${shapeId}'`);
      return found;
    };
    const shape = resolveShape('value_shape');
    const anchoredShape = resolveShape('anchored_value_shape');
    if (anchoredShape && !shape) {
      throw new PackError(
        `fields[${i}].anchored_value_shape`,
        'a field with an anchored shape must also declare a strict value_shape for checks to test against',
      );
    }

    return {
      id,
      label: str(o.label, `fields[${i}].label`),
      shortLabel: str(o.short_label, `fields[${i}].short_label`),
      anchors,
      shape,
      anchoredShape,
      unanchoredRecovery: o.unanchored_recovery === true,
      valueMaySpanLines: num(o.value_may_span_lines, `fields[${i}].value_may_span_lines`),
      valuePresentation: parsePresentation(o.value_presentation, `fields[${i}].value_presentation`),
      anchorRemainderIsValue: o.anchor_remainder_is_value === true,
    };
  });

  const fieldIds = new Set(fields.map((f) => f.id));

  const declarations: CompiledDeclaration[] = arr(root.declarations, 'declarations').map((d, i) => {
    const o = obj(d, `declarations[${i}]`);
    const fieldId = str(o.field, `declarations[${i}].field`);
    if (!fieldIds.has(fieldId)) {
      throw new PackError(`declarations[${i}].field`, `unknown field '${fieldId}'`);
    }
    return {
      id: str(o.id, `declarations[${i}].id`),
      fieldId,
      check: compileCheck(o.check, shapes, `declarations[${i}].check`),
      clause: compileClause(o.clause, `declarations[${i}].clause`),
      title: str(o.title, `declarations[${i}].title`),
      requirement: str(o.requirement, `declarations[${i}].requirement`),
      remedy: str(o.remedy, `declarations[${i}].remedy`),
      severityIfFailed: capSeverity(
        str(o.severity_if_failed, `declarations[${i}].severity_if_failed`),
        provenanceStatus,
      ),
    };
  });

  const byId = new Map(fields.map((f) => [f.id, f]));

  return {
    metadata,
    fields,
    declarations,
    fieldById: (id: string) => byId.get(id),
  };
}

/** Compile an arbitrary pack object. Exported for tests. */
export function compilePack(raw: unknown): CompiledPack {
  return compile(raw);
}

/** The demo pack, compiled once at module load. Throws at startup if it is malformed. */
export const DEMO_PACK: CompiledPack = compile(rawPack);
