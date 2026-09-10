/**
 * What a capture is, where it came from, and the one path from an image to a verdict.
 *
 * **Phase `C-0` moved the verdict off the live loop.** Until now the judged frame was
 * whatever the scan loop had most recently recognised, taken with `skipProcessing: true`
 * — which skips autofocus settle, HDR and multi-frame noise reduction, exactly the
 * processing that makes 1–2 mm print legible. That is the right trade for a *preview*
 * frame and the wrong one for the frame a verdict rests on (`docs/DEMO_PLAN.md` §4, C-0).
 *
 * So a capture now declares its own provenance, and the type says which kinds a verdict
 * may rest on. `'viewfinder'` is excluded from `JudgedCapture` by construction: the live
 * loop cannot produce a verdict, and that is enforced by the compiler rather than by
 * everyone remembering.
 *
 * Demo scaffolding, like the rest of `mobile/`.
 */
import { DEMO_PACK } from '../rulepack/pack';
import { extract } from '../scan/extract';
import type { CaptureSource, ExtractionResult, OcrFrame } from '../scan/types';
import { evaluate } from '../verdict/evaluate';
import type { Verdict } from '../verdict/types';
import { recognise } from './ocr';

export interface Capture {
  /** The image on disk, so the frame can be displayed and drawn over. */
  readonly uri: string;
  readonly frame: OcrFrame;
  /**
   * Shutter-to-file milliseconds, kept apart from `frame.ocrMs` (P8).
   *
   * `null` for an upload: the photo was taken minutes ago by another app, so there is no
   * shutter latency this app can claim. A zero here would be a number the method cannot
   * support (P4), and it would quietly drag down any latency average computed later.
   */
  readonly captureMs: number | null;
  /** Increases with every capture; lets the UI distinguish a fresh image from a repeat. */
  readonly seq: number;
  readonly source: CaptureSource;
}

/**
 * A capture a verdict may rest on.
 *
 * The live loop's own passes are excluded by type, which is `C-0`'s "the live preview no
 * longer produces a verdict" stated where it cannot be forgotten.
 */
export interface JudgedCapture extends Capture {
  readonly source: Exclude<CaptureSource, 'viewfinder'>;
}

/** A judged capture with the cascade's working and the verdict that followed. */
export interface Judgement {
  readonly capture: JudgedCapture;
  /**
   * Kept beside the verdict so `D-3`'s recorder can write the cascade's working — which
   * stage recovered each value and how sure it was.
   */
  readonly extraction: ExtractionResult;
  readonly verdict: Verdict;
}

export interface JudgeInput {
  readonly uri: string;
  /** The image's pixel dimensions as the *producing* layer reported them. */
  readonly width: number;
  readonly height: number;
  readonly captureMs: number | null;
  readonly seq: number;
  readonly source: JudgedCapture['source'];
}

/**
 * Recognise an image and reach a verdict on it.
 *
 * The single path, shared by the still and the upload, so that the field-trial recorder
 * — and `T-2.8`'s gold set after it — cannot tell the two apart except by `source`.
 *
 * `extract` and `evaluate` are pure and sub-millisecond; the whole cost here is OCR.
 */
export async function judge(input: JudgeInput): Promise<Judgement> {
  const frame = await recognise(input.uri, input.width, input.height);
  const extraction = extract(DEMO_PACK, frame.lines);
  const verdict = evaluate(DEMO_PACK, frame, extraction);
  return {
    capture: {
      uri: input.uri,
      frame,
      captureMs: input.captureMs,
      seq: input.seq,
      source: input.source,
    },
    extraction,
    verdict,
  };
}
