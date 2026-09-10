import type { Severity } from '../rulepack/pack';
import type { AdmissionResult } from '../scan/admit';
import type { Association, Box, Confidence, ExtractionStage } from '../scan/types';

/**
 * The overall outcome of a scan.
 *
 * Note what is deliberately absent: there is no `COMPLIANT`. The demo cannot certify
 * compliance — it can only report that it found no issue among the eight declarations it
 * checks, which is a much narrower claim (P3). The wording on screen matches.
 */
export type VerdictStatus =
  /** Too little text, or too few fields, to conclude anything. */
  | 'INSUFFICIENT_EVIDENCE'
  /** Every check the pack could run passed. */
  | 'NO_ISSUES_FOUND'
  /** At least one declaration did not pass. */
  | 'ATTENTION';

export interface FindingClause {
  readonly statuteCode: string;
  readonly statuteLong: string;
  readonly rule: string;
  readonly subClause: string;
  /** True when the sub-clause letter itself is disputed; the UI must say so. */
  readonly contested: boolean;
  readonly alternateSubClauses: readonly string[];
  readonly note: string;
  readonly verification: string;
}

export interface Finding {
  readonly declarationId: string;
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly title: string;
  readonly requirement: string;
  readonly remedy: string;
  readonly severity: Severity;
  readonly clause: FindingClause;
  /** Rule-pack identity, so a finding can be traced to the exact data that produced it. */
  readonly packId: string;
  readonly packVersion: string;
  /** The image region a person can look at to agree or disagree (P7). Null if the */
  /** finding is an absence and there is nothing to point at. */
  readonly evidenceBox: Box | null;
  readonly evidenceText: string | null;
}

export interface FieldReport {
  readonly fieldId: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly found: boolean;
  readonly value: string | null;
  readonly stage: ExtractionStage | null;
  readonly confidence: Confidence | null;
  /**
   * The geometry that tied a stage-B value to its anchor, or null when geometry was not
   * what chose it. Carried to the screen because "the value 2.6 text-heights to the right
   * of the label" is the kind of working an officer can check against the photograph,
   * where a bare confidence word is not (P7).
   */
  readonly association: Association | null;
  readonly box: Box | null;
}

export interface Verdict {
  readonly status: VerdictStatus;
  readonly findings: readonly Finding[];
  readonly fields: readonly FieldReport[];
  /** Why the verdict is INSUFFICIENT_EVIDENCE, in words fit for the screen. */
  readonly insufficientReason: string | null;
  /**
   * Frame admission's working (`D-4`) — what was measured about the picture itself.
   *
   * Always present, whether or not it refused, so the screen can show an officer the
   * numbers behind a refusal *and* state which qualities went unmeasured on a frame that
   * passed. A verdict that hid this would be claiming a quality check it did not run
   * (**P9**).
   */
  readonly admission: AdmissionResult;
  readonly packId: string;
  readonly packVersion: string;
  readonly statuteLong: string;
  readonly scopeNote: string;
  readonly provenanceStatus: string;
  readonly provenanceNote: string;
  /** True while no finding in this pack may be presented as a determination of law. */
  readonly advisoryOnly: boolean;
  readonly counts: {
    readonly fieldsExpected: number;
    readonly fieldsFound: number;
    readonly ocrLines: number;
  };
  readonly timings: {
    readonly ocrMs: number;
    readonly extractMs: number;
    readonly evaluateMs: number;
  };
}
