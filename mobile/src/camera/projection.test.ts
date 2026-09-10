import { describe, expect, it } from 'vitest';

import {
  clampBox,
  fitTransform,
  projectBox,
  resolveCoordinateFrame,
  rotateBox,
  rotatedSize,
  type Rect,
  type Size,
} from './projection';

/** The D-1 measurement, kept as the test's landscape capture. */
const CAPTURE: Size = { width: 4096, height: 3072 };
/** A portrait preview, roughly the Nord 4's usable area in density-independent pixels. */
const PREVIEW: Size = { width: 412, height: 830 };

function corners(r: Rect) {
  return [r.x, r.y, r.x + r.width, r.y + r.height].map((n) => Math.round(n));
}

describe('clampBox', () => {
  it('leaves a box that is already inside the image untouched', () => {
    const box = { x: 10, y: 20, width: 100, height: 40 };
    expect(clampBox(box, CAPTURE)).toEqual(box);
  });

  it('trims the overhang D-1 actually measured', () => {
    // One capture reported a bottom of 3086 against a height of 3072: an axis-aligned
    // box around a tilted line of text genuinely extends past the edge.
    const clamped = clampBox({ x: 100, y: 3000, width: 500, height: 86 }, CAPTURE);
    expect(clamped).toEqual({ x: 100, y: 3000, width: 500, height: 72 });
  });

  it('returns null rather than a sliver when the box is wholly outside', () => {
    // A degenerate rectangle drawn where evidence should be is worse than nothing (P7).
    expect(clampBox({ x: 5000, y: 10, width: 40, height: 40 }, CAPTURE)).toBeNull();
    expect(clampBox({ x: -200, y: 10, width: 50, height: 40 }, CAPTURE)).toBeNull();
  });
});

describe('rotateBox', () => {
  const image: Size = { width: 100, height: 40 };

  it('is the identity at zero turns', () => {
    const box = { x: 10, y: 5, width: 20, height: 8 };
    expect(rotateBox(box, image, 0)).toEqual(box);
  });

  it('sends the top-left corner to the top-right at one clockwise turn', () => {
    const box = { x: 0, y: 0, width: 20, height: 8 };
    const turned = rotateBox(box, image, 1);
    // In the rotated 40×100 frame the box now hangs from the right edge.
    expect(corners(turned)).toEqual([32, 0, 40, 20]);
  });

  it('swaps width and height on odd turns and preserves them on even ones', () => {
    const box = { x: 10, y: 5, width: 20, height: 8 };
    for (const turns of [1, 3] as const) {
      const r = rotateBox(box, image, turns);
      expect([r.width, r.height]).toEqual([8, 20]);
    }
    for (const turns of [0, 2] as const) {
      const r = rotateBox(box, image, turns);
      expect([r.width, r.height]).toEqual([20, 8]);
    }
  });

  it('returns to the original after four quarter turns', () => {
    const box = { x: 13, y: 7, width: 21, height: 9 };
    let carried = box;
    let frame = image;
    for (let i = 0; i < 4; i += 1) {
      carried = rotateBox(carried, frame, 1);
      frame = rotatedSize(frame, 1);
    }
    expect(carried).toEqual(box);
    expect(frame).toEqual(image);
  });

  it('keeps every rotated box inside the rotated frame', () => {
    const frame = rotatedSize(CAPTURE, 1);
    const box = { x: 0, y: 0, width: CAPTURE.width, height: CAPTURE.height };
    const turned = rotateBox(box, CAPTURE, 1);
    expect(corners(turned)).toEqual([0, 0, frame.width, frame.height]);
  });
});

describe('resolveCoordinateFrame', () => {
  it('detects the transposition measured on the device in D-2', () => {
    // The real reading: ML Kit reported an extent of 2650×3505 while expo-camera called
    // the file 4096×3072. A box cannot be taller than its own image, so the coordinates
    // are in the upright 3072×4096 frame, not the sensor's landscape buffer.
    const boxes: Rect[] = [
      { x: 40, y: 120, width: 2610, height: 90 },
      { x: 100, y: 3400, width: 500, height: 105 },
    ];
    expect(resolveCoordinateFrame(boxes, CAPTURE)).toEqual({
      size: { width: 3072, height: 4096 },
      transposed: true,
    });
  });

  it('keeps the reported frame when the boxes fit it', () => {
    const boxes: Rect[] = [{ x: 10, y: 20, width: 3000, height: 100 }];
    expect(resolveCoordinateFrame(boxes, CAPTURE)).toEqual({
      size: CAPTURE,
      transposed: false,
    });
  });

  it('tolerates the small overhang a tilted line produces without transposing', () => {
    // D-1's 3086 against a height of 3072. That is a tilted line, not a wrong frame, and
    // transposing on it would break every capture that is merely slightly askew.
    const boxes: Rect[] = [{ x: 100, y: 3000, width: 500, height: 86 }];
    expect(resolveCoordinateFrame(boxes, CAPTURE).transposed).toBe(false);
  });

  it('keeps the reported frame when the boxes fit neither', () => {
    // Something else is wrong. Guessing here would stack a second bug on the first; the
    // caller is told nothing was transposed and the extent readout shows the mismatch.
    const boxes: Rect[] = [{ x: 0, y: 0, width: 9000, height: 9000 }];
    expect(resolveCoordinateFrame(boxes, CAPTURE)).toEqual({
      size: CAPTURE,
      transposed: false,
    });
  });

  it('reports the frame unchanged when there is no geometry at all', () => {
    expect(resolveCoordinateFrame([], CAPTURE)).toEqual({ size: CAPTURE, transposed: false });
  });

  it('leaves a square capture alone — its transpose is itself', () => {
    const square: Size = { width: 2048, height: 2048 };
    const boxes: Rect[] = [{ x: 0, y: 0, width: 2000, height: 60 }];
    expect(resolveCoordinateFrame(boxes, square).transposed).toBe(false);
  });
});

describe('fitTransform', () => {
  it('cover fills the view and lets the overflow fall outside it', () => {
    const source: Size = { width: 3072, height: 4096 };
    const { scale, dx, dy } = fitTransform(source, PREVIEW, 'cover');
    expect(scale).toBeCloseTo(PREVIEW.height / source.height, 10);
    expect(dy).toBeCloseTo(0, 10);
    expect(dx).toBeLessThan(0); // wider than the view — cropped left and right
  });

  it('contain letterboxes instead of cropping', () => {
    const source: Size = { width: 3072, height: 4096 };
    const { scale, dx, dy } = fitTransform(source, PREVIEW, 'contain');
    expect(scale).toBeCloseTo(PREVIEW.width / source.width, 10);
    expect(dx).toBeCloseTo(0, 10);
    expect(dy).toBeGreaterThan(0);
  });

  it('does not divide by zero on a source with no area', () => {
    expect(fitTransform({ width: 0, height: 0 }, PREVIEW, 'cover')).toEqual({
      scale: 1,
      dx: 0,
      dy: 0,
    });
  });
});

describe('projectBox', () => {
  it('maps a full-frame box onto the whole contained view', () => {
    const projected = projectBox(
      { x: 0, y: 0, width: CAPTURE.width, height: CAPTURE.height },
      CAPTURE,
      PREVIEW,
      'contain',
    );
    expect(projected).not.toBeNull();
    // No turn is applied: 4096×3072 is far wider than it is tall relative to the view, so
    // contain fits to the width and letterboxes above and below.
    expect(projected!.width).toBeCloseTo(PREVIEW.width, 6);
    expect(projected!.x).toBeCloseTo(0, 6);
    expect(projected!.y).toBeGreaterThan(0);
  });

  it('holds a box inside the view under cover fit', () => {
    const projected = projectBox(
      { x: 1000, y: 800, width: 900, height: 120 },
      CAPTURE,
      PREVIEW,
      'cover',
    );
    expect(projected).not.toBeNull();
    expect(projected!.width).toBeGreaterThan(0);
    expect(projected!.height).toBeGreaterThan(0);
  });

  it('clamps before it projects, so an overhanging box never spills past the view', () => {
    const projected = projectBox(
      { x: 100, y: 3000, width: 500, height: 86 },
      CAPTURE,
      PREVIEW,
      'contain',
    );
    expect(projected).not.toBeNull();
    const bottomOfImage = projectBox(
      { x: 0, y: 0, width: CAPTURE.width, height: CAPTURE.height },
      CAPTURE,
      PREVIEW,
      'contain',
    )!;
    expect(projected!.x).toBeGreaterThanOrEqual(bottomOfImage.x - 0.001);
    expect(projected!.x + projected!.width).toBeLessThanOrEqual(
      bottomOfImage.x + bottomOfImage.width + 0.001,
    );
  });

  it('returns null before the view has been laid out', () => {
    const box = { x: 10, y: 10, width: 50, height: 50 };
    expect(projectBox(box, CAPTURE, { width: 0, height: 0 }, 'cover')).toBeNull();
    expect(projectBox(box, { width: 0, height: 0 }, PREVIEW, 'cover')).toBeNull();
  });

  it('returns null for a box that clamped away entirely', () => {
    expect(
      projectBox({ x: 9000, y: 10, width: 50, height: 50 }, CAPTURE, PREVIEW, 'cover'),
    ).toBeNull();
  });
});
