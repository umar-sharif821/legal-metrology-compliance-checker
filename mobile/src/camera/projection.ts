/**
 * Image-pixel → view-pixel projection for the overlay and the evidence highlight.
 *
 * Kept pure and free of any React Native import so it runs under Node in the root
 * `npm test` gate. This is the one piece of D-2 that is easy to get subtly wrong and
 * impossible to eyeball afterwards: a box drawn 90° out looks like an OCR failure, not
 * a geometry bug, and a box that overhangs the frame looks like a bad capture.
 *
 * Three transforms, in this order, and the order matters:
 *
 *  1. **Clamp** to the image's own bounds. D-1 measured a box reporting a bottom of
 *     3086 against an image height of 3072 — an axis-aligned box drawn around a tilted
 *     line of text genuinely can overhang the edge. Clamping first means every later
 *     step operates on a rectangle that is actually inside the picture.
 *  2. **Rotate** by a whole number of quarter turns. The capture comes off the sensor
 *     landscape while the phone is held portrait, so the two frames differ by a turn.
 *  3. **Fit** into the view — `cover` for the live preview, which crops to fill the
 *     screen, and `contain` for the frozen still, which is letterboxed so the whole
 *     capture stays visible next to its highlight.
 *
 * Demo scaffolding. `T-1.12` owns the real preview/frame alignment, against a frame
 * processor rather than a still capture. Do not promote this file.
 */

/** Clockwise quarter turns. 1 = 90° CW, 2 = 180°, 3 = 270° CW (i.e. 90° CCW). */
export type QuarterTurns = 0 | 1 | 2 | 3;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** How a source image is fitted into a view box. Matches the RN `resizeMode` names. */
export type FitMode = 'cover' | 'contain';

/**
 * How far a box may exceed the frame before the frame is judged to be the wrong one.
 *
 * Not zero, because an axis-aligned box drawn around a *tilted* line of text genuinely
 * overhangs the edge of the image it came from — D-1 measured a bottom of 3086 against a
 * height of 3072, half a percent over. Two percent absorbs that without absorbing a
 * transposition, which is off by tens of percent.
 */
const FRAME_TOLERANCE = 0.02;

export interface ResolvedFrame {
  /** The frame the coordinates are actually expressed in. */
  readonly size: Size;
  /** True when that is the transpose of what the capture layer reported. */
  readonly transposed: boolean;
}

/**
 * Work out which frame the OCR engine's coordinates are really in.
 *
 * The capture layer reports the dimensions of the file it wrote. The OCR engine reports
 * boxes in whatever frame it decided to read that file in — and with `skipProcessing`
 * those differ: expo-camera hands back the sensor's landscape buffer with an EXIF
 * orientation tag, ML Kit honours the tag, and its coordinates come back in the upright
 * portrait frame. Measured on the Nord 4 at D-2: an extent of 2650×3505 against a
 * reported 4096×3072, and an extent taller than its own image is not possible.
 *
 * So the frame is *measured* rather than assumed. If the boxes do not fit the reported
 * frame but do fit its transpose, the transpose is the truth. If they fit neither, the
 * reported frame is kept — a wrong guess at that point would be a second bug on top of
 * whatever the first one is, and `transposed` lets the screen say what happened (P9).
 *
 * This supersedes the D-1 note that no transposition was needed. That reading came from a
 * capture whose extent happened to fit both frames; this one cannot.
 */
export function resolveCoordinateFrame(boxes: readonly Rect[], reported: Size): ResolvedFrame {
  if (boxes.length === 0) return { size: reported, transposed: false };

  let right = 0;
  let bottom = 0;
  for (const box of boxes) {
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }

  const fits = (size: Size) =>
    right <= size.width * (1 + FRAME_TOLERANCE) && bottom <= size.height * (1 + FRAME_TOLERANCE);

  const swapped: Size = { width: reported.height, height: reported.width };
  if (!fits(reported) && fits(swapped)) return { size: swapped, transposed: true };
  return { size: reported, transposed: false };
}

/**
 * The image's dimensions after `turns` quarter turns.
 *
 * Unused by this route, and kept deliberately. `resolveCoordinateFrame` establishes that
 * both ML Kit's coordinates and React Native's `Image` and camera preview present the
 * EXIF-upright frame, so a still capture never needs turning — the frame only ever needed
 * *transposing*, and rotating it as well was this phase's one real bug. A frame processor
 * (`T-1.12`) is the case that does need this: it receives raw sensor buffers with no EXIF
 * to honour, so the turn has to be applied by hand there.
 */
export function rotatedSize(image: Size, turns: QuarterTurns): Size {
  return turns % 2 === 0 ? image : { width: image.height, height: image.width };
}

function rotatePoint(x: number, y: number, image: Size, turns: QuarterTurns): [number, number] {
  switch (turns) {
    case 0:
      return [x, y];
    case 1:
      return [image.height - y, x];
    case 2:
      return [image.width - x, image.height - y];
    case 3:
      return [y, image.width - x];
  }
}

/**
 * Clamp a box to the image's bounds, or return null if nothing of it survives.
 *
 * Null rather than a zero-area rectangle on purpose: a box entirely outside the frame is
 * not evidence, and drawing a degenerate sliver where evidence should be would be worse
 * than drawing nothing (P7).
 */
export function clampBox(box: Rect, image: Size): Rect | null {
  const left = Math.max(0, Math.min(box.x, image.width));
  const top = Math.max(0, Math.min(box.y, image.height));
  const right = Math.max(0, Math.min(box.x + box.width, image.width));
  const bottom = Math.max(0, Math.min(box.y + box.height, image.height));
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Rotate an axis-aligned box within its image.
 *
 * Both opposite corners are rotated and the result re-normalised to min/max rather than
 * the new origin being derived per case. At quarter turns the box stays axis-aligned, so
 * this is exact — and it is far harder to typo than four hand-written coordinate swaps.
 */
export function rotateBox(box: Rect, image: Size, turns: QuarterTurns): Rect {
  const [ax, ay] = rotatePoint(box.x, box.y, image, turns);
  const [bx, by] = rotatePoint(box.x + box.width, box.y + box.height, image, turns);
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

export interface FitTransform {
  readonly scale: number;
  readonly dx: number;
  readonly dy: number;
}

/**
 * The scale and centring offsets that fit `source` into `view`.
 *
 * `cover` takes the larger scale and lets the overflow fall outside the view — which is
 * what the camera preview does, so a box near the edge of the capture is correctly drawn
 * off-screen rather than squeezed into view. `contain` takes the smaller and letterboxes.
 */
export function fitTransform(source: Size, view: Size, mode: FitMode): FitTransform {
  if (source.width <= 0 || source.height <= 0) return { scale: 1, dx: 0, dy: 0 };
  const sx = view.width / source.width;
  const sy = view.height / source.height;
  const scale = mode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  return {
    scale,
    dx: (view.width - source.width * scale) / 2,
    dy: (view.height - source.height * scale) / 2,
  };
}

/**
 * Project one image-pixel box into view pixels.
 *
 * `image` must be the frame the *coordinates* are in — the one `resolveCoordinateFrame`
 * measured, not the one the capture layer reported. Given that, no rotation is applied by
 * default, and `turns` exists for a caller that knows its source needs one.
 *
 * Returns null when the box does not survive the clamp, or when either the image or the
 * view has no area yet — the view's size arrives from `onLayout` one frame late, and a
 * projection against a zero-sized view would scatter boxes into the corner.
 */
export function projectBox(
  box: Rect,
  image: Size,
  view: Size,
  mode: FitMode,
  turns: QuarterTurns = 0,
): Rect | null {
  if (image.width <= 0 || image.height <= 0) return null;
  if (view.width <= 0 || view.height <= 0) return null;

  const clamped = clampBox(box, image);
  if (!clamped) return null;

  const rotated = rotateBox(clamped, image, turns);
  const source = rotatedSize(image, turns);
  const { scale, dx, dy } = fitTransform(source, view, mode);

  return {
    x: rotated.x * scale + dx,
    y: rotated.y * scale + dy,
    width: rotated.width * scale,
    height: rotated.height * scale,
  };
}
