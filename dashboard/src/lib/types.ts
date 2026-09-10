/**
 * Wire and view types.
 *
 * These deliberately mirror `mobile/src/verdict/types.ts`. The same legal finding is
 * rendered on the phone, in this dashboard and in the PDF notice; three divergent
 * shapes for one finding is a correctness risk, not merely a maintenance cost
 * (plan §12, "One verdict view, three surfaces").
 */
import type { Severity } from './rulepack';

/**
 * Note what is absent: there is no `COMPLIANT`. The tool cannot certify compliance —
 * it can report that it found no issue among the declarations it actually checked,
 * which is a far narrower claim (P3). Every label on screen matches that.
 */
export type ScanStatus = 'NO_ISSUES_FOUND' | 'ATTENTION' | 'INSUFFICIENT_EVIDENCE';

export type Confidence = 'high' | 'medium' | 'low';

/** How a value was tied to its declaration. Shown because an officer can check it. */
export type ExtractionStage = 'anchored' | 'geometry' | 'shape_only';

export interface Box {
  /** Normalised to the image, 0..1, origin top-left. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FieldReport {
  readonly fieldId: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly found: boolean;
  readonly value: string | null;
  readonly stage: ExtractionStage | null;
  readonly confidence: Confidence | null;
  /** The geometric working, in words an officer can check against the photograph. */
  readonly association: string | null;
  readonly box: Box | null;
}

export interface Finding {
  readonly declarationId: string;
  readonly severity: Severity;
  readonly evidenceText: string | null;
  readonly evidenceBox: Box | null;
}

/**
 * One frame-admission check (`D-4`). `measured: null` means the check could not be
 * run on this frame — a third outcome, distinct from pass and fail (P9).
 */
export interface FrameCheck {
  readonly id: string;
  readonly label: string;
  readonly question: string;
  readonly measured: number | null;
  readonly threshold: number;
  readonly format: 'percent' | 'ratio';
  readonly direction: 'min' | 'max';
  readonly passed: boolean | null;
}

export interface Admission {
  readonly admitted: boolean;
  readonly reason: string | null;
  readonly checks: readonly FrameCheck[];
  /**
   * Qualities this method does not measure, named in full. A frame can pass every
   * check above and still be too blurry to trust; saying so is the whole point (P9).
   */
  readonly unmeasured: readonly string[];
  readonly hints: readonly string[];
}

export type ScanSource = 'device' | 'upload';

export interface Scan {
  readonly id: string;
  readonly capturedAt: string;
  readonly officer: string;
  readonly district: string;
  readonly category: string;
  readonly brand: string;
  readonly commodity: string;
  readonly status: ScanStatus;
  readonly source: ScanSource;
  /** Object URL for an uploaded image; null when the sample label is drawn instead. */
  readonly imageUrl: string | null;
  readonly fields: readonly FieldReport[];
  readonly findings: readonly Finding[];
  readonly admission: Admission;
  readonly insufficientReason: string | null;
  /**
   * Every line of text the engine actually read, in order.
   *
   * This is the input the whole verdict rests on, and until it was on screen a wrong
   * value was indistinguishable from a wrong rule. An officer disputing a finding needs
   * to see what the machine saw, not just what it concluded (P7). Empty for sample
   * records, which have no OCR behind them.
   */
  readonly ocrLines: readonly string[];
  readonly packId: string;
  readonly packVersion: string;
  readonly timings: {
    readonly ocrMs: number;
    readonly extractMs: number;
    readonly evaluateMs: number;
  };
  /**
   * True when this record came from the bundled sample corpus rather than a live
   * backend. The UI states it, every time, on every screen that shows a number
   * derived from it — an unlabelled sample is indistinguishable from a measurement,
   * and this project does not quote numbers its method cannot support (P8).
   */
  readonly sample: boolean;
}
