/**
 * Shared image handling and the recognition-provider contract.
 *
 * Every recognition engine produces `Candidate`s and nothing downstream can tell which
 * engine made one. Extraction, frame admission, evaluation and the report are all written
 * against `OcrFrame`, so swapping the recogniser is a change to one module rather than a
 * change to the pipeline. That is what `A-0` built this seam for.
 */
import type { OcrFrame } from '@engine/scan/types';

/**
 * One way of reading an image.
 *
 * More than one is produced when several readings are worth trying — a whole frame and a
 * cropped panel, or two page-segmentation modes. The caller runs extraction over each and
 * keeps the reading that both survived its own quality checks and located the most
 * declarations.
 */
export interface Candidate {
  readonly frame: OcrFrame;
  readonly width: number;
  readonly height: number;
  /** The image this reading was taken from — what the report must display. */
  readonly canvas: HTMLCanvasElement;
  /** Fraction of the original area this reading covers. 1 for the whole frame. */
  readonly fraction: number;
}

/**
 * Decode and orient.
 *
 * An `<img>` element rather than `createImageBitmap`, because browsers apply the file's
 * EXIF orientation to it. A phone photo that arrives rotated would otherwise be read
 * sideways, which looks like a recognition failure and is not one.
 */
export async function loadImageElement(
  file: File,
): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('The browser could not decode that image.'));
    el.src = url;
  });
  return { img, revoke: () => URL.revokeObjectURL(url) };
}

/** Draw a region of an image onto a canvas no larger than `maxEdge`. */
export function renderTo(
  img: HTMLImageElement,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The browser refused a 2D canvas, so the image cannot be read.');
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/** The analysed canvas as an object URL, so the report shows what was actually judged. */
export function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.9)),
      'image/jpeg',
      0.92,
    );
  });
}

/** Base64 (no data: prefix) of a canvas, for an API that takes inline image bytes. */
export function canvasBase64(canvas: HTMLCanvasElement, quality = 0.9): string {
  return canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? '';
}
