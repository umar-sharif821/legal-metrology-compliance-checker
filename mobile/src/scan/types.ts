/**
 * The shapes that flow between the camera, the OCR engine and the evaluator.
 *
 * Kept free of any React Native import on purpose: everything downstream of the camera
 * is plain TypeScript, so it runs under Node in the test suite and cannot quietly grow
 * a dependency on a device.
 */

/**
 * Where an image came from — the provenance `C-0` made it necessary to record.
 *
 * A stock-camera photo and a `skipProcessing` preview frame are different measurements of
 * the same label, and a corpus that mixes them without saying which is which cannot
 * answer the question `C-0` exists to ask (P8). Lives here rather than beside the camera
 * because the field-trial record carries it, and the record's types must stay loadable
 * under Node.
 *
 * - `viewfinder` — a live loop pass. Fast, unprocessed, framing feedback only, and since
 *   `C-0` never the basis of a verdict.
 * - `still` — a full-quality `takePictureAsync` the operator asked for.
 * - `upload` — a photo taken with the stock camera app and picked from the gallery.
 */
export type CaptureSource = 'viewfinder' | 'still' | 'upload';

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
  /**
   * Pixel dimensions of the frame the boxes are relative to.
   *
   * Not necessarily the dimensions of the file that was captured. The OCR engine reads
   * the file's EXIF orientation and reports coordinates in the upright frame, which for a
   * portrait-held phone is the transpose of the sensor's landscape buffer. This is the
   * frame that was *measured* from the boxes themselves, not the one the camera reported.
   */
  readonly imageWidth: number;
  readonly imageHeight: number;
  /** True when the two disagreed and the reported dimensions had to be transposed (P9). */
  readonly coordinatesTransposed: boolean;
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
