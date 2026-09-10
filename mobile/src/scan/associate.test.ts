/**
 * Stage B's geometry, tested on its own.
 *
 * `extract.test.ts` covers the cascade end to end; this file pins the pairing rule itself,
 * in terms that do not depend on the demo pack's fields or on any packet still existing.
 * Every case here is a statement about *where things are printed*, which is the only thing
 * `associate` is allowed to reason about.
 */

import { describe, expect, it } from 'vitest';

import rawPack from '../rulepack/demo-lmpc-v0.json';
import { compilePack, DEMO_PACK, type SpatialAssociation } from '../rulepack/pack';
import { associate, type Candidate } from './associate';
import type { Box } from './types';

const CFG: SpatialAssociation = DEMO_PACK.metadata.association;

/** An anchor 100 px tall, so a "text height" is a round number in every case below. */
const ANCHOR: Box = { x: 1000, y: 1000, width: 300, height: 100 };

/** How far down a one-row field may look, in anchor heights — what `extract` passes. */
const ONE_ROW = CFG.rowPitchHeights;

function candidate(index: number, box: Box, matchesStrictShape = true): Candidate {
  return { index, box, matchesStrictShape };
}

describe('anchor-value association', () => {
  it('pairs an anchor with the value printed to its right', () => {
    // The record 002 geometry, in round numbers: the value sits well to the right of the
    // label and on the same row. List order put nineteen unrelated entries between them.
    const chosen = associate(
      ANCHOR,
      [candidate(9, { x: 1600, y: 990, width: 400, height: 120 })],
      ONE_ROW,
      CFG,
    );
    expect(chosen?.candidate.index).toBe(9);
    expect(chosen?.association.direction).toBe('right');
    expect(chosen?.association.gapHeights).toBe(3);
    expect(chosen?.association.runnerUpScore).toBeNull();
  });

  it('pairs an anchor with the value printed below it', () => {
    const chosen = associate(
      ANCHOR,
      [candidate(4, { x: 1000, y: 1140, width: 200, height: 90 })],
      ONE_ROW,
      CFG,
    );
    expect(chosen?.candidate.index).toBe(4);
    expect(chosen?.association.direction).toBe('below');
  });

  it('tolerates a row tilted enough that the two boxes barely overlap', () => {
    // Measured on record 002: `NET QTY:` (y 3013-3136) and `84.9g` (y 2868-3037) share
    // only 24 px of height, because the packet was photographed by hand and the panel is
    // not square to the sensor. A vertical-overlap test would reject the correct answer;
    // the drift between the two row *centres* is 0.99 anchor heights and accepts it.
    const chosen = associate(
      { x: 886, y: 3013, width: 267, height: 123 },
      [candidate(49, { x: 1475, y: 2868, width: 419, height: 169 })],
      ONE_ROW,
      CFG,
    );
    expect(chosen?.candidate.index).toBe(49);
    expect(chosen?.association.direction).toBe('right');
  });

  it('refuses a value further to the right than the pack allows', () => {
    const tooFar = CFG.maxRightGapHeights * ANCHOR.height + ANCHOR.x + ANCHOR.width + 1;
    expect(
      associate(
        ANCHOR,
        [candidate(9, { x: tooFar, y: 1000, width: 400, height: 100 })],
        ONE_ROW,
        CFG,
      ),
    ).toBeNull();
  });

  it('refuses a value on a different row from the anchor', () => {
    // Same horizontal reach, but the row centres are far enough apart that this is another
    // line of the panel rather than the continuation of this one.
    const drift = CFG.maxRowDriftHeights * ANCHOR.height + 1;
    expect(
      associate(
        ANCHOR,
        [candidate(9, { x: 1600, y: 1000 + drift, width: 400, height: 100 })],
        ONE_ROW,
        CFG,
      ),
    ).toBeNull();
  });

  it('refuses a value stacked below but in a different column', () => {
    // Directly under the anchor in reading order, but printed in the next column along.
    expect(
      associate(ANCHOR, [candidate(4, { x: 1290, y: 1140, width: 400, height: 90 })], ONE_ROW, CFG),
    ).toBeNull();
  });

  it('refuses a value above the anchor', () => {
    expect(
      associate(ANCHOR, [candidate(4, { x: 1000, y: 700, width: 200, height: 90 })], ONE_ROW, CFG),
    ).toBeNull();
  });

  it('looks further down for a field whose value may span several rows', () => {
    const box: Box = { x: 1000, y: 1350, width: 400, height: 90 };
    // 2.5 anchor heights below: past a one-row field's reach, inside a three-row field's.
    expect(associate(ANCHOR, [candidate(4, box)], ONE_ROW, CFG)).toBeNull();
    expect(
      associate(ANCHOR, [candidate(4, box)], 3 * CFG.rowPitchHeights, CFG)?.candidate.index,
    ).toBe(4);
  });

  it('says nothing when two candidates are equally plausible', () => {
    // The whole reason there is a margin. One candidate 0.4 heights below and one 1.0
    // heights to the right are each a quarter of the way through their own reach, so they
    // score identically. That is not a hard question to answer well — it is a question
    // with no answer, and guessing is exactly the confident falsehood P3 exists to
    // prevent.
    const chosen = associate(
      ANCHOR,
      [
        candidate(4, { x: 1000, y: 1140, width: 300, height: 100 }),
        candidate(9, { x: 1400, y: 1000, width: 300, height: 100 }),
      ],
      ONE_ROW,
      CFG,
    );
    expect(chosen).toBeNull();
  });

  it('still answers when one candidate is clearly better than the other', () => {
    // The control for the test above: same two positions, but the far one moved out to
    // the edge of the reach so the near one wins by more than the margin.
    const chosen = associate(
      ANCHOR,
      [
        candidate(4, { x: 1000, y: 1110, width: 300, height: 100 }),
        candidate(9, { x: 1000 + 300 + 380, y: 1000, width: 300, height: 100 }),
      ],
      ONE_ROW,
      CFG,
    );
    expect(chosen?.candidate.index).toBe(4);
    expect(chosen?.association.runnerUpScore).not.toBeNull();
  });

  it('prefers a value that also clears the strict shape over a nearer one that does not', () => {
    // `Net Qty` beside both `250` and `250 g`: the second is the declaration, and being a
    // little further away does not change that. This is the "value-shape strength" half of
    // the score doing work the geometry alone cannot.
    const chosen = associate(
      ANCHOR,
      [
        candidate(4, { x: 1310, y: 1000, width: 100, height: 100 }, false),
        candidate(9, { x: 1500, y: 1000, width: 200, height: 100 }, true),
      ],
      ONE_ROW,
      CFG,
    );
    expect(chosen?.candidate.index).toBe(9);
    // And it does not win by an unlimited amount. The shape bonus is worth 0.4 of the
    // score against proximity's 0.6, so pushing the strict match out to 3 heights brings
    // the two back within the margin of each other — at which point the answer is neither
    // of them. A shape strong enough to outrank geometry is still not strong enough to
    // settle a question the geometry says is close (P3).
    const tooFar = associate(
      ANCHOR,
      [
        candidate(4, { x: 1310, y: 1000, width: 100, height: 100 }, false),
        candidate(9, { x: 1600, y: 1000, width: 200, height: 100 }, true),
      ],
      ONE_ROW,
      CFG,
    );
    expect(tooFar).toBeNull();

    // Further out still and the near one is a clear winner again, shape or no shape.
    const clear = associate(
      ANCHOR,
      [
        candidate(4, { x: 1310, y: 1000, width: 100, height: 100 }, false),
        candidate(9, { x: 1650, y: 1000, width: 200, height: 100 }, true),
      ],
      ONE_ROW,
      CFG,
    );
    expect(clear?.candidate.index).toBe(4);
  });

  it('is scale-invariant — the same label read from twice the distance pairs the same way', () => {
    // The reason every threshold is in anchor heights rather than pixels. Doubling the
    // whole geometry is the same label photographed from closer up, and it must not change
    // which line is the value, nor how the pairing is described.
    const scale = (b: Box, k: number): Box => ({
      x: b.x * k,
      y: b.y * k,
      width: b.width * k,
      height: b.height * k,
    });
    const value: Box = { x: 1600, y: 990, width: 400, height: 120 };
    const near = associate(ANCHOR, [candidate(9, value)], ONE_ROW, CFG);
    const far = associate(scale(ANCHOR, 2), [candidate(9, scale(value, 2))], ONE_ROW, CFG);
    expect(far?.association).toEqual(near?.association);
  });

  it('refuses to measure against an anchor with no height', () => {
    // No text height means no scale, and every threshold in the pack is expressed in it.
    // Dividing by zero would produce a decision, which is worse than producing none.
    expect(
      associate(
        { x: 1000, y: 1000, width: 300, height: 0 },
        [candidate(9, { x: 1600, y: 1000, width: 400, height: 100 })],
        ONE_ROW,
        CFG,
      ),
    ).toBeNull();
  });

  it('is a pure function of its input', () => {
    const candidates = [
      candidate(4, { x: 1000, y: 1140, width: 300, height: 100 }),
      candidate(9, { x: 1600, y: 1000, width: 300, height: 90 }),
    ];
    expect(associate(ANCHOR, candidates, ONE_ROW, CFG)).toEqual(
      associate(ANCHOR, candidates, ONE_ROW, CFG),
    );
  });
});

describe('where stage B gets its numbers', () => {
  /** The pack's own geometry block, as a mutable copy to tamper with. */
  function tamper(mutate: (a: Record<string, unknown>) => void) {
    const pack = structuredClone(rawPack) as {
      metadata: { spatial_association: Record<string, unknown> };
    };
    mutate(pack.metadata.spatial_association);
    return () => compilePack(pack);
  }

  it('takes every threshold from the pack, so tuning is a data change', () => {
    // P6, and the point of the whole exercise: there is no default in `associate.ts` or
    // `extract.ts` to fall back on, so none of these numbers can drift into code.
    expect(DEMO_PACK.metadata.association.maxRightGapHeights).toBeGreaterThan(0);
    expect(DEMO_PACK.metadata.association.rowPitchHeights).toBeGreaterThan(0);
  });

  it('refuses a pack that omits one of them rather than picking a number itself', () => {
    expect(tamper((a) => delete a.max_right_gap_heights)).toThrow(/spatial_association/);
  });

  it('refuses a threshold outside the range that makes it mean anything', () => {
    // A column overlap of 1.4 is not badly tuned, it is incoherent — no two boxes can
    // share more than all of the narrower one's width.
    expect(tamper((a) => (a.min_column_overlap = 1.4))).toThrow(/min_column_overlap/);
    expect(tamper((a) => (a.max_right_gap_heights = -1))).toThrow(/max_right_gap_heights/);
  });

  it('refuses a pack that weights neither proximity nor shape', () => {
    // Both weights zero leaves nothing to score with, and every candidate tied — which
    // the margin would then reject one by one. Refused at load instead, where it is
    // visible, rather than at scan time as a silent inability to extract anything.
    expect(
      tamper((a) => {
        a.proximity_weight = 0;
        a.shape_strength_weight = 0;
      }),
    ).toThrow(/proximity_weight/);
  });
});
