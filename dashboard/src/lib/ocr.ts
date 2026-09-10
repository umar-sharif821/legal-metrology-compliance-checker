/**
 * Text recognition in the browser.
 *
 * WHY THIS EXISTS: without it the web app cannot read an uploaded image at all, and the
 * only thing it could put on screen would be a record it made up. It did exactly that
 * once. Never again — an uploaded photograph is now either genuinely read, or the screen
 * says the read failed. There is no third path that invents a verdict.
 *
 * Everything is served from `public/tesseract/` rather than a CDN: the worker, the wasm
 * cores and the language data. That is 30 MB in the repository, and it buys the property
 * the project actually cares about — the analysis runs with the network unplugged (P2),
 * which also means it cannot fail because a venue's wifi is bad.
 *
 * TWO PASSES, and the measurement that justifies the second. A photograph of a packet on
 * a table is mostly table. Downscaling the whole frame to fit the recogniser leaves the
 * print a few pixels tall, and a real capture of a spice packet came back with 0 of 6
 * declarations located. Measured on a reproduction — the same label rendered small
 * within a large scene, then cropped to the panel and re-read:
 *
 *     whole frame:      6 lines · median line height 17px · 4/7 declarations detectable
 *     cropped to panel: 11 lines · median line height 49px · 5/7 declarations detectable
 *
 * The manufacturer line went from "autacourd by: Sus Foods rials Linded" to a readable
 * address. So pass one locates the text; pass two re-reads that region **from the
 * original image**, which is a genuine gain in pixels per glyph rather than an
 * upscale of an already-lost reading.
 *
 * What is deliberately NOT done: cropping is never used to flatter the frame-admission
 * numbers. When a crop is applied, the crop *is* the analysed frame — it is what the
 * report displays, what the evidence boxes land on, and what admission measures — and
 * the report says so. Measuring a crop while showing the original would inflate print
 * size and coverage against a picture nobody judged.
 *
 * The output is an `OcrFrame` in the shape the real engine already consumes, so nothing
 * downstream knows or cares that the text came from Tesseract rather than ML Kit on the
 * phone. That is the whole point of `A-0`'s provider seam.
 */
import { createWorker, type Worker } from 'tesseract.js';
import type { Box, OcrFrame, OcrLine } from '@engine/scan/types';
import { splitByGaps } from './lines';

/** Long edge for the first, whole-frame pass. */
const PASS_1_EDGE = 1600;
/** Long edge for the second pass over the located panel. Higher: it is a smaller region. */
const PASS_2_EDGE = 2400;
/** Only re-read when the text occupies less than this fraction of the frame's area. */
const CROP_WHEN_TEXT_BELOW = 0.55;
/** Ignore a "panel" smaller than this — it is noise, not a label. */
const MIN_CROP_AREA = 0.004;
/**
 * Margin added around the located text, as a fraction of the located region's size.
 *
 * The crop can only be as big as what the first pass managed to read, and the lines it
 * failed on are exactly the small ones near the panel's edges. Measured on the same
 * scene: a 6% margin left the consumer-care block outside the crop and it stayed missed;
 * an 18% margin brought it in but cost enough magnification elsewhere to lose the
 * manufacturer and the date. Neither margin wins outright, which is why the caller keeps
 * whichever *reading* located more declarations rather than trusting one crop.
 */
const CROP_MARGIN = 0.12;

let workerPromise: Promise<Worker> | null = null;

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
    // Speculative work; a real failure surfaces on the actual scan, where it can be shown.
  });
}

/**
 * Decode and orient.
 *
 * An `<img>` element rather than `createImageBitmap`, because browsers apply the file's
 * EXIF orientation to it. A phone photo that arrives rotated would otherwise be read
 * sideways, which looks like an OCR failure and is not one.
 */
async function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('The browser could not decode that image.'));
    el.src = url;
  });
  return { img, revoke: () => URL.revokeObjectURL(url) };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rendered {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
}

/**
 * Draw a region of the source image onto a canvas no larger than `maxEdge`.
 *
 * Downscaling is safe for every threshold the pack applies, because all of them are
 * fractions of the frame rather than pixel counts, and scaling uniformly leaves a
 * fraction unchanged.
 */
function render(img: HTMLImageElement, rect: Rect, maxEdge: number): Rendered {
  const scale = Math.min(1, maxEdge / Math.max(rect.w, rect.h));
  const width = Math.max(1, Math.round(rect.w * scale));
  const height = Math.max(1, Math.round(rect.h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The browser refused a 2D canvas, so the image cannot be read.');
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);

  return { canvas, width, height };
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

function tessLines(data: unknown): TessLine[] {
  const d = data as {
    blocks?: { paragraphs?: { lines?: TessLine[] }[] }[];
    lines?: TessLine[];
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
  return collected;
}

/**
 * Turn recognised lines into engine lines.
 *
 * Every line is re-checked against its own word geometry before being believed:
 * Tesseract will merge text from opposite ends of a panel into one line, and an
 * extractor cannot tell that from a real line. See `lines.ts` for the case that forced
 * this. If geometry is missing entirely the lines still come through with `box: null`,
 * which the engine reports as unmeasurable rather than as bad (P9).
 */
function toOcrLines(data: unknown, fallbackText: string): OcrLine[] {
  const collected = tessLines(data);

  if (collected.length > 0) {
    return collected.flatMap((l) =>
      splitByGaps(
        l.text ?? '',
        (l.words ?? []).map((w) => ({ text: w.text ?? '', box: toBox(w.bbox) })),
      ).filter((line) => line.text.length > 0),
    );
  }

  return fallbackText
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text) => ({ text, box: null }));
}

/** Bounding box of every word Tesseract placed, in the coordinates it reported. */
function textExtent(data: unknown): Box | null {
  const boxes: Box[] = [];
  for (const line of tessLines(data)) {
    for (const word of line.words ?? []) {
      const b = toBox(word.bbox);
      if (b && word.text?.trim()) boxes.push(b);
    }
  }
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * One way of reading the image.
 *
 * More than one is produced when a crop is worth trying, because neither the whole frame
 * nor the crop reliably wins: the frame keeps every declaration in view at low
 * resolution, the crop gives resolution but can cut off a block the first pass could not
 * see. The caller runs extraction over each and keeps the one that located more
 * declarations — the same best-of-N idea the phone applies to camera frames, and cheap
 * here because extraction costs about a millisecond while recognition costs a second.
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

export interface Recognised {
  readonly candidates: readonly Candidate[];
}

/** Read one image. Throws rather than returning anything invented. */
export async function recognise(file: File): Promise<Recognised> {
  const { img, revoke } = await loadImage(file);
  try {
    const worker = await getWorker();
    const full: Rect = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const startedAt = performance.now();

    // --- pass one: find the text ---
    const first = render(img, full, PASS_1_EDGE);
    const r1 = await worker.recognize(first.canvas, {}, { blocks: true, text: true });

    const extent = textExtent(r1.data);
    const frameArea = first.width * first.height;
    const textFraction = extent ? (extent.width * extent.height) / frameArea : 0;

    const build = (r: Rendered, data: unknown, fraction: number): Candidate => ({
      frame: {
        lines: toOcrLines(data, (data as { text?: string }).text ?? ''),
        imageWidth: r.width,
        imageHeight: r.height,
        // The canvas was drawn upright, so boxes and dimensions already agree.
        coordinatesTransposed: false,
        ocrMs: Math.round(performance.now() - startedAt),
      },
      width: r.width,
      height: r.height,
      canvas: r.canvas,
      fraction,
    });

    const candidates: Candidate[] = [build(first, r1.data, 1)];

    // --- pass two: re-read the located panel, from the original pixels ---
    if (extent && textFraction > MIN_CROP_AREA && textFraction < CROP_WHEN_TEXT_BELOW) {
      const back = full.w / first.width; // pass-1 canvas coords -> original coords
      const marginX = extent.width * back * CROP_MARGIN;
      const marginY = extent.height * back * CROP_MARGIN;
      const rect: Rect = {
        x: Math.max(0, extent.x * back - marginX),
        y: Math.max(0, extent.y * back - marginY),
        w: Math.min(full.w, extent.width * back + marginX * 2),
        h: Math.min(full.h, extent.height * back + marginY * 2),
      };
      rect.w = Math.min(rect.w, full.w - rect.x);
      rect.h = Math.min(rect.h, full.h - rect.y);

      const second = render(img, rect, PASS_2_EDGE);
      const r2 = await worker.recognize(second.canvas, {}, { blocks: true, text: true });
      candidates.push(build(second, r2.data, (rect.w * rect.h) / (full.w * full.h)));
    }

    return { candidates };
  } finally {
    revoke();
  }
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
