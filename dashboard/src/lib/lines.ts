/**
 * Repairing OCR line grouping.
 *
 * WHY THIS EXISTS, with the evidence that produced it. A Verka lassi packet was read as
 * having its manufacturer declared as "drnk based on fermented ~~ hr" — a confident,
 * completely wrong value. The raw line behind it was:
 *
 *     Manufactured, Packed & Marketed by: DRNK BASED ON FERMENTED ~~ hr
 *
 * Tesseract had merged two physically separate regions of the packet — the printed
 * "Manufactured, Packed & Marketed by:" label from one block and "DRINK BASED ON
 * FERMENTED" from another — into a single line. The extractor then did exactly what it
 * should: it found a properly printed, colon-terminated anchor and took the remainder of
 * "its" line as the value. The rule was right; the input was a lie.
 *
 * Note what this rules out. The rule pack's own note on `manufacturer_address` proposed
 * `anchor_must_be_labelled: true` as the remedy for a false manufacturer. It would not
 * have helped here — the anchor *was* labelled — and would have cost recall on
 * "Manufactured by ABC Foods" for nothing. This is an adapter defect, not a rule defect,
 * and it is fixed where it happens.
 *
 * THE MEASUREMENT behind the threshold, reproduced on a two-block test image:
 *
 *     within a real line:   word gaps of  9-10px against a 19-24px text height  (~0.5x)
 *     across the bad merge: a gap of     257px against the same height          (~13x)
 *
 * Two orders of magnitude apart, so any threshold in between works and 2.0 sits far from
 * both. This only ever *splits* a line — it can never join two, so it cannot introduce
 * the failure it exists to remove.
 *
 * This is a property of the Tesseract adapter, not of the Rules, which is why the
 * constant lives beside the adapter and not in the rule pack (P6 governs statutory
 * facts). ML Kit on the phone groups lines differently and needs none of this.
 */
import type { Box } from '@engine/scan/types';

/** Gap between neighbouring words, in multiples of the line's own text height. */
export const MAX_WORD_GAP_HEIGHTS = 2.0;

export interface Word {
  readonly text: string;
  readonly box: Box | null;
}

export interface SplitLine {
  readonly text: string;
  readonly box: Box | null;
}

function union(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

/**
 * Split one recognised line wherever its words separate by more than
 * `maxGapHeights` of their own text height.
 *
 * Returns the line unchanged when it cannot be judged — fewer than two words, or any
 * word missing geometry. Guessing without the boxes is what got us here.
 */
export function splitByGaps(
  fallbackText: string,
  words: readonly Word[],
  maxGapHeights: number = MAX_WORD_GAP_HEIGHTS,
): SplitLine[] {
  const usable = words.filter((w) => w.text.trim().length > 0);
  const boxed = usable.filter((w): w is Word & { box: Box } => w.box !== null);

  if (usable.length < 2 || boxed.length !== usable.length) {
    const text = fallbackText.trim();
    return text.length > 0 ? [{ text, box: union(boxed.map((w) => w.box)) }] : [];
  }

  const ordered = [...boxed].sort((a, b) => a.box.x - b.box.x);
  const limit = median(ordered.map((w) => w.box.height)) * maxGapHeights;

  const runs: (Word & { box: Box })[][] = [];
  let run: (Word & { box: Box })[] = [];

  for (const word of ordered) {
    const previous = run[run.length - 1];
    if (previous) {
      const gap = word.box.x - (previous.box.x + previous.box.width);
      if (gap > limit) {
        runs.push(run);
        run = [];
      }
    }
    run.push(word);
  }
  if (run.length > 0) runs.push(run);

  return runs.map((r) => ({
    text: r
      .map((w) => w.text.trim())
      .join(' ')
      .trim(),
    box: union(r.map((w) => w.box)),
  }));
}
