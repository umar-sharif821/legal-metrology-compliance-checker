/**
 * The dashboard's view of the rule pack.
 *
 * Nothing statutory is written in this file, or anywhere else in `src/`. Clause
 * numbers, sub-clause letters, declaration titles, the requirement text, the remedy
 * text, the severity cap and the provenance warning are all read from the pack (P6).
 * If you find yourself typing `"6(1)(e)"` into a component, it belongs here — and
 * here means the JSON, not this module.
 *
 * The import goes through the `@rulepack` alias defined in `vite.config.ts`, so
 * pointing the dashboard at the real pack is a one-line config change.
 */
import rawPack from '@rulepack';

export type Severity = 'advisory' | 'violation';
export type ProvenanceStatus = 'PENDING_LEGAL_REVIEW' | 'DISPUTED' | 'REVIEWED';

interface RawAlternateReading {
  sub_clause: string;
  source: string;
  note: string;
}

interface RawClause {
  rule: string;
  sub_clause: string;
  verification: string;
  alternate_readings?: RawAlternateReading[];
  note?: string;
}

interface RawDeclaration {
  id: string;
  field: string;
  check: { kind: string };
  clause: RawClause;
  title: string;
  requirement: string;
  remedy: string;
  severity_if_failed: Severity;
  evidence: string;
}

interface RawField {
  id: string;
  label: string;
  short_label: string;
}

interface RawFrameAdmission {
  note: string;
  min_text_height_fraction: number;
  min_text_coverage: number;
  max_edge_touch_fraction: number;
  unscored: string[];
}

interface RawPack {
  metadata: {
    pack_id: string;
    pack_version: string;
    demo_only?: boolean;
    statute_code: string;
    statute_long: string;
    jurisdiction: string;
    scope_note: string;
    provenance: {
      status: ProvenanceStatus;
      max_severity: Severity;
      reviewer: string | null;
      reviewed_on: string | null;
      note: string;
    };
    frame_admission: RawFrameAdmission;
    evidence_thresholds: { min_ocr_lines: number; min_fields_found: number; note: string };
  };
  fields: RawField[];
  declarations: RawDeclaration[];
}

const pack = rawPack as unknown as RawPack;

export interface Clause {
  readonly rule: string;
  readonly subClause: string;
  /** Rendered citation, e.g. `Rule 6(1)(e)`. Assembled from pack data, never typed. */
  readonly cite: string;
  readonly verification: string;
  /** True when the sub-clause letter itself is disputed. The UI must say so (P9). */
  readonly contested: boolean;
  readonly alternates: readonly RawAlternateReading[];
  readonly note: string;
}

export interface Declaration {
  readonly id: string;
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly fieldShortLabel: string;
  readonly checkKind: string;
  readonly title: string;
  readonly requirement: string;
  readonly remedy: string;
  readonly severity: Severity;
  readonly clause: Clause;
}

const fieldsById = new Map(pack.fields.map((f) => [f.id, f]));

function compile(d: RawDeclaration): Declaration {
  const field = fieldsById.get(d.field);
  if (!field) throw new Error(`Rule pack declaration ${d.id} names unknown field ${d.field}`);
  const alternates = d.clause.alternate_readings ?? [];
  return {
    id: d.id,
    fieldId: field.id,
    fieldLabel: field.label,
    fieldShortLabel: field.short_label,
    checkKind: d.check.kind,
    title: d.title,
    requirement: d.requirement,
    remedy: d.remedy,
    severity: d.severity_if_failed,
    clause: {
      rule: d.clause.rule,
      subClause: d.clause.sub_clause,
      cite: `Rule ${d.clause.rule}${d.clause.sub_clause}`,
      verification: d.clause.verification,
      contested: alternates.length > 0,
      alternates,
      note: d.clause.note ?? '',
    },
  };
}

export const DECLARATIONS: readonly Declaration[] = pack.declarations.map(compile);

export const DECLARATIONS_BY_ID = new Map(DECLARATIONS.map((d) => [d.id, d]));

export const FIELDS: readonly { id: string; label: string; shortLabel: string }[] = pack.fields.map(
  (f) => ({ id: f.id, label: f.label, shortLabel: f.short_label }),
);

export const PACK = {
  id: pack.metadata.pack_id,
  version: pack.metadata.pack_version,
  demoOnly: pack.metadata.demo_only === true,
  statuteCode: pack.metadata.statute_code,
  statuteLong: pack.metadata.statute_long,
  jurisdiction: pack.metadata.jurisdiction,
  scopeNote: pack.metadata.scope_note,
  provenanceStatus: pack.metadata.provenance.status,
  provenanceNote: pack.metadata.provenance.note,
  reviewer: pack.metadata.provenance.reviewer,
  reviewedOn: pack.metadata.provenance.reviewed_on,
  maxSeverity: pack.metadata.provenance.max_severity,
} as const;

/**
 * While the pack is unreviewed, no finding may be presented as a determination of
 * law. The cap is read from the pack, not assumed — a reviewed pack lifts it by
 * changing data, with no code change here.
 */
export const ADVISORY_ONLY = PACK.maxSeverity === 'advisory';

/** Severity a failed declaration may actually be shown at, after the pack's cap. */
export function cappedSeverity(d: Declaration): Severity {
  return ADVISORY_ONLY ? 'advisory' : d.severity;
}

/**
 * Frame-admission parameters (`D-4`). Method parameters, not statutory values — but
 * still pack data, so the screen shows the same threshold the evaluator applied.
 *
 * `unscored` is the important one. Blur and glare are NOT measured, and the UI is
 * required to say so rather than let a frame that passed these three checks read as
 * a frame that was checked for sharpness (P9).
 */
export const FRAME_ADMISSION = {
  minTextHeightFraction: pack.metadata.frame_admission.min_text_height_fraction,
  minTextCoverage: pack.metadata.frame_admission.min_text_coverage,
  maxEdgeTouchFraction: pack.metadata.frame_admission.max_edge_touch_fraction,
  unscored: pack.metadata.frame_admission.unscored as readonly string[],
} as const;

export const EVIDENCE_THRESHOLDS = {
  minOcrLines: pack.metadata.evidence_thresholds.min_ocr_lines,
  minFieldsFound: pack.metadata.evidence_thresholds.min_fields_found,
} as const;
