/**
 * Frame admission's tests (`D-4`).
 *
 * Two things are pinned here that are easy to lose later: that no threshold is allowed to
 * live in code, and that the honesty limit — blur and glare unscored — is *stated* rather
 * than quietly dropped. The second is exactly the line someone tidying the UI would
 * delete, so a test holds it.
 */
import { describe, expect, it } from 'vitest';

import { DEMO_PACK } from '../rulepack/pack';
import { admit, hintsFor, isBetterFrame } from './admit';
import type { Box, OcrFrame, OcrLine } from './types';

const W = 1000;
const H = 2000;

function line(box: Box | null, text = 'NET QUANTITY'): OcrLine {
  return { text, box };
}

function frame(lines: OcrLine[]): OcrFrame {
  return {
    lines,
    imageWidth: W,
    imageHeight: H,
    coordinatesTransposed: false,
    ocrMs: 1,
  };
}

/** A well-framed panel: readable print, well inside the frame, plenty of it. */
function goodLines(count = 12): OcrLine[] {
  return Array.from({ length: count }, (_, i) =>
    line({ x: 150, y: 300 + i * 90, width: 700, height: 60 }),
  );
}

const T = DEMO_PACK.metadata.frameAdmission;

describe('admit', () => {
  it('admits a well-framed panel', () => {
    const r = admit(frame(goodLines()), T);
    expect(r.admitted).toBe(true);
    expect(r.refusedReason).toBeNull();
    expect(r.unmeasurable).toBe(false);
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('refuses print that is too small to resolve, and says which check failed', () => {
    // Same layout, but each line a few pixels tall — the packet photographed from a metre away.
    const tiny = Array.from({ length: 12 }, (_, i) =>
      line({ x: 150, y: 300 + i * 30, width: 700, height: 8 }),
    );
    const r = admit(frame(tiny), T);
    expect(r.admitted).toBe(false);
    const failed = r.checks.filter((c) => !c.passed).map((c) => c.id);
    expect(failed).toContain('text_height');
    expect(r.refusedReason).toMatch(/too small/i);
  });

  it('refuses a frame that is mostly not text', () => {
    // One stray word on a shelf, not a declaration panel.
    const r = admit(frame([line({ x: 400, y: 900, width: 120, height: 40 })]), T);
    expect(r.admitted).toBe(false);
    expect(r.checks.filter((c) => !c.passed).map((c) => c.id)).toContain('text_coverage');
  });

  it('refuses a panel running off the edge of the frame', () => {
    const cut = Array.from({ length: 12 }, (_, i) =>
      line({ x: 0, y: 300 + i * 90, width: W, height: 60 }),
    );
    const r = admit(frame(cut), T);
    expect(r.admitted).toBe(false);
    expect(r.checks.filter((c) => !c.passed).map((c) => c.id)).toContain('edge_touch');
  });

  it('separates "could not measure" from "measured and failed" (P9)', () => {
    const r = admit(frame([line(null), line(null)]), T);
    expect(r.unmeasurable).toBe(true);
    expect(r.admitted).toBe(false);
    expect(r.checks.every((c) => c.measured === null)).toBe(true);
    // Not a judgement about the picture — a limit of the reading.
    expect(r.refusedReason).toMatch(/could not be judged/i);
  });

  it('reports what it did not measure at all, on a frame that passed (P4, P9)', () => {
    const r = admit(frame(goodLines()), T);
    expect(r.unscored).toContain('blur');
    expect(r.unscored).toContain('glare');
    // No check may claim to be one of them: admission measures geometry only.
    expect(r.checks.map((c) => c.id)).toEqual(['text_height', 'text_coverage', 'edge_touch']);
  });

  it('carries the measured value and its threshold, so a person can check the working (P7)', () => {
    const r = admit(frame(goodLines()), T);
    for (const c of r.checks) {
      expect(typeof c.measured).toBe('number');
      expect(c.threshold).toBe(
        c.id === 'text_height'
          ? T.minTextHeightFraction
          : c.id === 'text_coverage'
            ? T.minTextCoverage
            : T.maxEdgeTouchFraction,
      );
    }
  });

  it('takes every threshold from the pack, never from code (P6)', () => {
    // Move the bar in the data and the same frame must change answer. If a default ever
    // creeps into admit.ts this fails.
    const strict = { ...T, minTextHeightFraction: 0.9 };
    expect(admit(frame(goodLines()), T).admitted).toBe(true);
    expect(admit(frame(goodLines()), strict).admitted).toBe(false);
  });
});

describe('coach hints', () => {
  it('gives an actionable hint per failed check, and none when the frame is fine', () => {
    expect(hintsFor(admit(frame(goodLines()), T))).toEqual([]);

    const tiny = Array.from({ length: 12 }, (_, i) =>
      line({ x: 150, y: 300 + i * 30, width: 700, height: 8 }),
    );
    const hints = hintsFor(admit(frame(tiny), T));
    expect(hints).toContain('Move closer');
  });

  it('never coaches about sharpness, which is not measured (P4)', () => {
    const all = [goodLines(), [line({ x: 0, y: 0, width: W, height: 20 })]].flatMap((ls) =>
      hintsFor(admit(frame(ls), T)),
    );
    for (const h of all) {
      expect(h).not.toMatch(/blur|sharp|focus|steady|glare/i);
    }
  });
});

describe('best-of-N frame choice', () => {
  it('prefers the frame that passes more checks', () => {
    const good = admit(frame(goodLines()), T);
    const cutOff = admit(
      frame(
        Array.from({ length: 12 }, (_, i) => line({ x: 0, y: 300 + i * 90, width: W, height: 60 })),
      ),
      T,
    );
    expect(isBetterFrame(good, cutOff)).toBe(true);
    expect(isBetterFrame(cutOff, good)).toBe(false);
  });

  it('breaks a tie on how much of the frame is text, not on recency', () => {
    const more = admit(frame(goodLines(14)), T);
    const fewer = admit(frame(goodLines(7)), T);
    expect(isBetterFrame(more, fewer)).toBe(true);
    expect(isBetterFrame(fewer, more)).toBe(false);
  });

  it('never prefers a frame it could not measure', () => {
    const unmeasurable = admit(frame([line(null)]), T);
    const poorButMeasured = admit(frame([line({ x: 400, y: 900, width: 120, height: 40 })]), T);
    expect(isBetterFrame(unmeasurable, poorButMeasured)).toBe(false);
    expect(isBetterFrame(poorButMeasured, unmeasurable)).toBe(true);
  });
});
