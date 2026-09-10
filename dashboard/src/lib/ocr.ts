/**
 * Text recognition in the browser.
 *
 * WHY THIS EXISTS: without it the web app cannot read an uploaded image at all, and the
 * only thing it could put on screen would be a record it made up. It did exactly that
 * once. Never again — an uploaded photograph is now either genuinely read, or the
 * screen says the read failed. There is no third path that invents a verdict.
 *
 * Everything is served from `public/tesseract/` rather than a CDN: the worker, the wasm
 * core and the language data. That is 17 MB in the repository, and it buys the property
 * the project actually cares about — the analysis runs with the network unplugged (P2),
 * which also means it cannot fail because a venue's wifi is bad.
 *
 * The output is an `OcrFrame` in the shape the real engine already consumes, so nothing
 * downstream of here knows or cares that the text came from Tesseract rather than from
 * ML Kit on the phone. That is the whole point of `A-0`'s provider seam.
 */
import { createWorker, type Worker } from 'tesseract.js';
import type { Box, OcrFrame, OcrLine } from '@engine/scan/types';
import { splitByGaps } from './lines';

/** Long edge, in pixels, that a photo is scaled to before recognition. */
const MAX_EDGE = 1600;

let workerPromise: Promise<Worker> | null = null;

/**
 * One worker, created once and reused.
 *
 * Spinning one up costs a second or two — paid on the first scan, or earlier if the
 * page calls `warmUpOcr()` while the operator is still choosing a file.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/',
    langPath: '/tesseract',
    gzip: true,
  });
  return workerPromise;
}

/** Start loading the engine before it is needed. Safe to call more than once. */
export function warmUpOcr(): void {
  void getWorker().catch(() => {
    // Swallowed on purpose: this is speculative work. A real failure surfaces on the
    // actual scan, where there is somewhere to report it.
  });
}

interface Prepared {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
}

/**
 * Decode, orient and downscale.
 *
 * An `<img>` element is used rather than `createImageBitmap` because browsers apply the
 * file's EXIF orientation to it, and a phone photo that arrives rotated would otherwise
 * be read sideways — which reads as an OCR failure and is not one.
 *
 * Downscaling is safe for every threshold the pack applies, because all of them are
 * *fractions of the frame* rather than pixel counts. Scaling uniformly leaves each
 * fraction unchanged.
 */
async function prepare(file: File): Promise<Prepared> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('The browser could not decode that image.'));
      el.src = url;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The browser refused a 2D canvas, so the image cannot be read.');
    ctx.drawImage(img, 0, 0, width, height);

    return { canvas, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface TessBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function toBox(bbox: TessBBox | undefined): Box | null {
  if (!bbox) return null;
  const width = bbox.x1 - bbox.x0;
  const height = bbox.y1 - bbox.y0;
  if (!(width > 0) || !(height > 0)) return null;
  return { x: bbox.x0, y: bbox.y0, width, height };
}

interface TessWord {
  text?: string;
  bbox?: TessBBox;
}

interface TessLine {
  text?: string;
  bbox?: TessBBox;
  words?: TessWord[];
}

/**
 * Pull line-level results out of whatever shape this build of Tesseract returned.
 *
 * Deliberately tolerant. If the geometry is missing the lines still come through with
 * `box: null`, which the engine already treats as "no evidence region" and reports as
 * unmeasurable rather than as bad (P9). Losing the boxes must degrade the evidence, not
 * the reading.
 */
function linesFrom(data: unknown): OcrLine[] {
  const d = data as {
    blocks?: { paragraphs?: { lines?: TessLine[] }[] }[];
    lines?: TessLine[];
    text?: string;
  };

  const collected: TessLine[] = [];

  if (Array.isArray(d.blocks)) {
    for (const block of d.blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) collected.push(line);
      }
    }
  }
  if (collected.length === 0 && Array.isArray(d.lines)) collected.push(...d.lines);

  if (collected.length > 0) {
    // Each recognised line is re-checked against its own word geometry before being
    // believed. Tesseract will merge text from opposite ends of a panel into one line,
    // and an extractor cannot tell that from a real line — see `lines.ts` for the case
    // that forced this.
    return collected.flatMap((l) =>
      splitByGaps(
        l.text ?? '',
        (l.words ?? []).map((w) => ({ text: w.text ?? '', box: toBox(w.bbox) })),
      ).filter((line) => line.text.length > 0),
    );
  }

  // Last resort: text with no geometry at all. Worth returning — the declarations can
  // still be extracted by anchor — but every evidence region will be absent, and the
  // frame will report itself unmeasurable rather than pretending otherwise.
  return (d.text ?? '')
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text) => ({ text, box: null }));
}

export interface Recognised {
  readonly frame: OcrFrame;
  readonly width: number;
  readonly height: number;
}

/** Read one image. Throws rather than returning anything invented. */
export async function recognise(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<Recognised> {
  const { canvas, width, height } = await prepare(file);
  const worker = await getWorker();

  const startedAt = performance.now();
  const result = await worker.recognize(
    canvas,
    {},
    // `blocks` is what carries per-line geometry, and geometry is what the evidence
    // regions and the whole frame-admission step are built on.
    { blocks: true, text: true },
  );
  const ocrMs = Math.round(performance.now() - startedAt);
  onProgress?.(1);

  const lines = linesFrom(result.data);

  return {
    frame: {
      lines,
      imageWidth: width,
      imageHeight: height,
      // The canvas was drawn upright, so the boxes and the dimensions already agree.
      coordinatesTransposed: false,
      ocrMs,
    },
    width,
    height,
  };
}
