/**
 * The ML Kit adapter — the only file in the app that knows the OCR engine's own shapes.
 *
 * Everything downstream consumes `OcrFrame` from `src/scan/types`, so swapping engines is
 * a change to this file alone. Since `A-0` that promise is written down as a type: this
 * file exports `mlKitProvider`, the first implementation of `scan/provider.ts`'s
 * `OcrProvider`, and the app's capture paths hold that interface rather than this module.
 */
import TextRecognition, {
  TextRecognitionScript,
  type Frame,
  type TextRecognitionResult,
} from '@react-native-ml-kit/text-recognition';

import { providerDescriptor, type OcrProvider, type OcrRequest } from '../scan/provider';
import type { Box, OcrFrame, OcrLine } from '../scan/types';
import { resolveCoordinateFrame } from './projection';

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

  // The dimensions the caller reported describe the *file*; the boxes may be expressed in
  // its transpose, because ML Kit honours the EXIF orientation that `skipProcessing` left
  // on it. Which one is true is decided by measuring the boxes, not by assuming.
  const { size, transposed } = resolveCoordinateFrame(
    lines.flatMap((line) => (line.box ? [line.box] : [])),
    { width: imageWidth, height: imageHeight },
  );

  return {
    lines,
    imageWidth: size.width,
    imageHeight: size.height,
    coordinatesTransposed: transposed,
    ocrMs,
  };
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

/**
 * ML Kit, as an `OcrProvider`.
 *
 * The app's single provider. It is a value rather than a lookup because the demo ships
 * exactly one engine and reaches its verdict on the device alone (`DEMO_PLAN` §2.1);
 * a second engine is scored by replaying a committed image on a host, never by running
 * here. See `scan/provider.ts` for why there is no registry of implementations.
 */
export const mlKitProvider: OcrProvider = {
  id: providerDescriptor('mlkit').id,
  label: providerDescriptor('mlkit').label,
  recognise: ({ uri, width, height }: OcrRequest) => recognise(uri, width, height),
};
