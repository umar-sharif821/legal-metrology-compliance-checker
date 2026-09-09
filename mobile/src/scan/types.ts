/**
 * The shapes that flow between the camera, the OCR engine and the evaluator.
 *
 * Kept free of any React Native import on purpose: everything downstream of the camera
 * is plain TypeScript, so it runs under Node in the test suite and cannot quietly grow
 * a dependency on a device.
 */

/** A bounding box in **image pixel** coordinates, origin top-left. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One line of recognised text, as ML Kit reports it. */
export interface OcrLine {
  /** Raw recognised text, exactly as returned. Never mutated. */
  readonly text: string;
  /** Null when the engine gave no geometry — the evidence path degrades, visibly. */
  readonly box: Box | null;
}

export interface OcrFrame {
  readonly lines: readonly OcrLine[];
  /** Pixel dimensions of the image the boxes are relative to. */
  readonly imageWidth: number;
  readonly imageHeight: number;
  /** Wall-clock milliseconds the OCR call took, for the latency claims (P8). */
  readonly ocrMs: number;
}

/** Which stage of the extraction cascade recovered a value. Mirrors plan §7.2. */
export type ExtractionStage =
  /** Anchor and value found on the same line. */
  | 'A_anchored_inline'
  /** Anchor on one line, value on a following line. */
  | 'B_anchored_adjacent'
  /** No anchor anywhere; recovered from the value's shape alone. */
  | 'C_shape_only';

export type Confidence = 'high' | 'medium' | 'low';

export interface ExtractedField {
  readonly fieldId: string;
  /** The substring judged to be the declared value. */
  readonly value: string;
  /** The full text of the line(s) the value came from — shown as evidence. */
  readonly sourceText: string;
  readonly lineIndexes: readonly number[];
  /** Union of the source lines' boxes. Null when the engine reported no geometry. */
  readonly box: Box | null;
  readonly stage: ExtractionStage;
  readonly confidence: Confidence;
}

export interface ExtractionResult {
  readonly fields: readonly ExtractedField[];
  /** Every line, normalised, index-aligned with the input. */
  readonly normalisedLines: readonly string[];
  /** All normalised lines joined by newline — used for whole-panel phrase checks. */
  readonly normalisedText: string;
  readonly extractMs: number;
}
