/**
 * Stage B's geometry — pairing an anchor with its value by where they sit on the label.
 *
 * Plan §7.2 Stage B, pulled forward from `T-2.3` as demo phase `A-4`. This module is the
 * whole of the change: `extract.ts` decides *which* lines are anchors and what a value
 * has to look like; this file decides *which* of those candidates is actually the one the
 * anchor is labelling.
 *
 * ## Why list order had to go
 *
 * Before this, Stage B paired an anchor at list index `i` with lines `i+1 … i+n`. That
 * list is OCR reading order over the whole panel, which on a two-column declaration block
 * is not adjacency on the label at all. Measured on field-trial record 002: `NET QTY:` is
 * line 30 and its value `84.9g` is line **49** — nineteen entries away, and printed
 * 322 px to its right on the same row. The value had been recognised correctly and was
 * lost anyway, which is why no OCR upgrade would have fixed it (`DEMO_PLAN` §2.1).
 *
 * ## What replaces it
 *
 * Two directional neighbourhoods around the anchor's box, exactly as the plan describes:
 *
 * - **right** — the value shares the anchor's row and sits to the right of it. Bounded by
 *   a horizontal gap and by how far the two rows' vertical centres may drift apart. The
 *   drift bound is what makes a hand-held, slightly rotated photograph work: on record 002
 *   the row is tilted enough that the anchor and its value overlap by only 24 px, but
 *   their centres are 0.99 anchor-heights apart.
 * - **below** — the value is on the next row down, in the same column. Bounded by the
 *   vertical gap and by how much of the narrower box's width the two share.
 *
 * **Every distance is in multiples of the anchor's own text height.** A label read from
 * 15 cm and the same label read from 30 cm produce boxes at different pixel scales but the
 * same ratios, so the thresholds do not have to be re-tuned per camera or per distance.
 *
 * ## Scoring, and the right to refuse
 *
 * Candidates are scored on two things the plan names: geometric proximity, and how
 * strongly the text looks like the field's value. The second is real signal — after an
 * anchor has identified the row, `extract` admits candidates on a deliberately loose
 * shape so that a malformed declaration is still recovered, and a candidate that *also*
 * satisfies the field's strict shape is a better bet than one that only clears the loose
 * one. Weights and floors are pack data.
 *
 * The best candidate must clear an absolute floor **and** beat the runner-up by a margin.
 * Two candidates that are equally plausible means the geometry did not answer the
 * question, and the honest output is nothing: a missing declaration is an advisory saying
 * "rescan the panel", where a wrong one is a confident falsehood about what is printed
 * (P3).
 *
 * Pure: same boxes in, same choice out. No clock, no I/O, no randomness (P1).
 */

import type { SpatialAssociation } from '../rulepack/pack';
import type { Association, AssociationDirection, Box } from './types';

/** One line offered to the association step. */
export interface Candidate {
  /** Index into the caller's line list — carried through so the caller can cite it. */
  readonly index: number;
  readonly box: Box;
  /**
   * Does this candidate satisfy the field's **strict** shape, not merely the loose one
   * the anchor licensed? A `value_shape` hit is stronger evidence than an
   * `anchored_value_shape` hit; a field with no strict shape scores every candidate 0
   * here and is decided on geometry alone.
   */
  readonly matchesStrictShape: boolean;
}

export interface AssociationChoice {
  readonly candidate: Candidate;
  readonly association: Association;
}

/** Rounded so a score printed on screen and a score in a fixture are the same number. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function centreY(b: Box): number {
  return b.y + b.height / 2;
}

/**
 * Fraction of the narrower box's width that the two boxes share horizontally.
 *
 * The *narrower* box on purpose: a short value under a long label (`1 kg` under
 * `Net Quantity`) is completely covered by it and should read as fully aligned, which
 * dividing by the wider box's width would not give.
 */
function columnOverlap(a: Box, b: Box): number {
  const shared = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const narrower = Math.min(a.width, b.width);
  if (narrower <= 0) return 0;
  return Math.max(0, shared) / narrower;
}

/**
 * Place a candidate in one of the anchor's neighbourhoods, or reject it.
 *
 * Returns the direction and a **cost** in 0–1, where 0 is perfectly placed and 1 is at
 * the very edge of what the pack allows. The cost is the worse of the two constraints
 * that define the neighbourhood, not their average: a candidate at the limit of the
 * horizontal reach is at the limit whatever its vertical alignment, and averaging would
 * let one good axis buy a bad one.
 */
function place(
  anchor: Box,
  candidate: Box,
  /** How far below the anchor this field's value may be, in anchor heights. */
  belowReachHeights: number,
  cfg: SpatialAssociation,
): {
  readonly direction: AssociationDirection;
  readonly cost: number;
  readonly gap: number;
} | null {
  const h = anchor.height;
  // A zero-height anchor gives no scale to measure against, so there is no honest answer.
  if (h <= 0) return null;

  // ---- right: same row, further along it ---------------------------------
  const gapX = candidate.x - (anchor.x + anchor.width);
  if (gapX >= 0) {
    const drift = Math.abs(centreY(candidate) - centreY(anchor));
    const ratioX = gapX / h / cfg.maxRightGapHeights;
    const ratioY = drift / h / cfg.maxRowDriftHeights;
    if (ratioX <= 1 && ratioY <= 1) {
      return { direction: 'right', cost: Math.max(ratioX, ratioY), gap: round2(gapX / h) };
    }
  }

  // ---- below: next row down, same column ---------------------------------
  const gapY = candidate.y - (anchor.y + anchor.height);
  if (gapY >= 0 && belowReachHeights > 0) {
    const ratioY = gapY / h / belowReachHeights;
    const overlap = columnOverlap(anchor, candidate);
    if (ratioY <= 1 && overlap >= cfg.minColumnOverlap) {
      // Misalignment is expressed as a cost the same way a distance is: perfectly
      // stacked is 0, and sharing exactly the minimum permitted width is 1.
      const misalignment = (1 - overlap) / Math.max(1e-9, 1 - cfg.minColumnOverlap);
      return { direction: 'below', cost: Math.max(ratioY, misalignment), gap: round2(gapY / h) };
    }
  }

  return null;
}

/**
 * Choose the value belonging to `anchorBox` from `candidates`, or refuse.
 *
 * `belowReachHeights` is the field's own reach downwards — `extract` derives it from the
 * pack's `value_may_span_lines` for that field, so a three-line address may look further
 * down than a one-line quantity. Everything else is pack-wide.
 *
 * Returns null when nothing is in either neighbourhood, when the best candidate does not
 * clear the pack's floor, or when it does not beat the runner-up by the pack's margin.
 */
export function associate(
  anchorBox: Box,
  candidates: readonly Candidate[],
  belowReachHeights: number,
  cfg: SpatialAssociation,
): AssociationChoice | null {
  const weightTotal = cfg.proximityWeight + cfg.shapeStrengthWeight;
  if (weightTotal <= 0) return null;

  const scored: { readonly choice: AssociationChoice; readonly score: number }[] = [];
  for (const candidate of candidates) {
    const placed = place(anchorBox, candidate.box, belowReachHeights, cfg);
    if (placed === null) continue;
    const proximity = 1 - placed.cost;
    const strength = candidate.matchesStrictShape ? 1 : 0;
    const score = round2(
      (cfg.proximityWeight * proximity + cfg.shapeStrengthWeight * strength) / weightTotal,
    );
    scored.push({
      choice: {
        candidate,
        association: {
          direction: placed.direction,
          gapHeights: placed.gap,
          score,
          runnerUpScore: null,
        },
      },
      score,
    });
  }

  if (scored.length === 0) return null;

  // Sort by score, then by line index. The tie-break is not cosmetic: two candidates with
  // identical geometry and identical shape strength must resolve the same way on every
  // run, or the decision layer stops being a pure function of its input (P1). Reading
  // order is the only ordering the input carries.
  scored.sort((a, b) => b.score - a.score || a.choice.candidate.index - b.choice.candidate.index);

  const best = scored[0];
  const runnerUp = scored.length > 1 ? scored[1].score : null;

  if (best.score < cfg.minScore) return null;
  if (runnerUp !== null && best.score - runnerUp < cfg.minMargin) return null;

  return {
    candidate: best.choice.candidate,
    association: { ...best.choice.association, runnerUpScore: runnerUp },
  };
}
