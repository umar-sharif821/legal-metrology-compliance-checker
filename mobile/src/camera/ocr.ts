/**
 * The ML Kit adapter — the only file in the app that knows the OCR engine's own shapes.
 *
 * Everything downstream consumes `OcrFrame` from `src/scan/types`, so swapping engines
 * (route B in `docs/DEMO_PLAN.md` §3, PaddleOCR on the server later) is a change to
 * this file alone.
 */
import TextRecognition, {
  TextRecognitionScript,
  type Frame,
  type TextRecognitionResult,
} from '@react-native-ml-kit/text-recognition';

import type { Box, OcrFrame, OcrLine } from '../scan/types';

/**
 * Latin only, for now.
 *
 * ML Kit ships one recogniser per script and cannot run two in a single call. Devanagari
 * is cut from the demo (`docs/DEMO_PLAN.md` §2), and P9 says a degraded path must say so
 * rather than look clean — so the UI names the script it ran, and a Hindi-only label
 * comes back with no lines rather than with a quiet approximation.
 */
const SCRIPT = TextRecognitionScript.LATIN;

export const OCR_SCRIPT_NAME: string = SCRIPT;

/**
 * ML Kit reports a box as `{ left, top, width, height }`; the rest of the app uses
 * `{ x, y, width, height }`.
 *
 * A line without geometry yields `null`, never a zero box. A fabricated origin would put
 * an evidence crop over the wrong part of the label, and P7 requires evidence a person
 * can actually check. The finite-number guard is not paranoia: these values cross the
 * native bridge untyped.
 */
function toBox(frame: Frame | undefined): Box | null {
  if (!frame) return null;
  const { left, top, width, height } = frame;
  const finite = [left, top, width, height].every(
    (n) => typeof n === 'number' && Number.isFinite(n),
  );
  if (!finite || width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

/**
 * Flatten ML Kit's block → line tree into the flat line list the cascade expects.
 *
 * Order is block-major, and that matters: `extract.ts` Stage B associates an anchor with
 * a value on a *following* line, so adjacency here is adjacency within a block. ML Kit
 * groups a label's panel into blocks by layout, which is usually what we want — but a
 * two-column panel can interleave, and that is a known limit to measure in `T-2.3`
 * against the gold set rather than guess at now.
 */
export function toOcrFrame(
  result: TextRecognitionResult,
  imageWidth: number,
  imageHeight: number,
  ocrMs: number,
): OcrFrame {
  const lines: OcrLine[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      lines.push({ text: line.text, box: toBox(line.frame) });
    }
  }
  return { lines, imageWidth, imageHeight, ocrMs };
}

/**
 * Run OCR over an image already on disk.
 *
 * `imageWidth` / `imageHeight` are the capturing layer's word for the image's pixel
 * dimensions; they are carried, not measured here, because only the caller knows whether
 * the file it wrote was rotated on the way out.
 */
export async function recognise(
  uri: string,
  imageWidth: number,
  imageHeight: number,
): Promise<OcrFrame> {
  const startedAt = Date.now();
  const result = await TextRecognition.recognize(uri, SCRIPT);
  return toOcrFrame(result, imageWidth, imageHeight, Date.now() - startedAt);
}
