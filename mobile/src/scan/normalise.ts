/**
 * Text normalisation — the shared pre-pass before any matching.
 *
 * Deliberately conservative. Every transformation here is one that cannot change which
 * declaration a line is about; anything cleverer (character-confusion repair, unit
 * canonicalisation, spell correction) is left to `T-2.1`, where it can be measured
 * against the gold set instead of guessed at.
 *
 * The rule of thumb: normalisation may make matching easier, never make a wrong match
 * possible. A false flag costs more than a missed flag (P3).
 */

/**
 * Rupee is written many ways on Indian packaging and OCR'd many more. All of them
 * collapse to the sign so one pattern in the rule pack covers the lot.
 *
 * `₨` (U+20A8) and `Rs`/`RS.` are the common variants; the standalone `र` is not
 * included because it is an ordinary Devanagari letter and folding it would corrupt
 * Hindi text the moment Devanagari OCR is switched on.
 *
 * The trailing dot is consumed on purpose. Written `\brs\.?\b`, the engine backtracks
 * off the dot — there is no word boundary after it — and leaves `₹. 45`, which no price
 * shape matches. `\brs\b\.?` puts the boundary before the dot and swallows it.
 */
const RUPEE_VARIANTS = /₨|\brs\b\.?|\binr\b\.?/gi;

/** Zero-width and bidi marks. ML Kit emits these occasionally around mixed scripts. */
const INVISIBLES = /[​-‏‪-‮⁠﻿]/g;

/** Unicode dashes and quotes that break literal matching in anchors. */
const DASHES = /[‐-―−]/g;
const QUOTES = /[‘’‚‛]/g;
const DQUOTES = /[“”„‟]/g;

/**
 * Normalise one OCR line.
 *
 * Lower-cased, NFKC-folded, invisibles stripped, punctuation variants unified, runs of
 * whitespace collapsed. Length and word order are preserved; nothing is deleted that
 * carries meaning.
 */
export function normaliseLine(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(INVISIBLES, '')
    .replace(DASHES, '-')
    .replace(QUOTES, "'")
    .replace(DQUOTES, '"')
    .toLowerCase()
    .replace(RUPEE_VARIANTS, '₹')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseLines(raw: readonly string[]): string[] {
  return raw.map(normaliseLine);
}

/**
 * Find an anchor term in a normalised line.
 *
 * Returns the index just past the anchor, so the caller can take the remainder of the
 * line as the candidate value — or `-1` when no anchor matches. Anchors are expected
 * pre-sorted longest-first by the pack loader, so the most specific one wins.
 *
 * Matching is substring-based rather than word-boundary-based because real labels run
 * the anchor into its punctuation: `MRP:`, `M.R.P.`, `Net Qty.`, `NetWt`.
 */
export function findAnchorEnd(line: string, anchors: readonly string[]): number {
  for (const anchor of anchors) {
    const at = line.indexOf(anchor);
    if (at !== -1) return at + anchor.length;
  }
  return -1;
}

/**
 * Strip the punctuation a label puts between an anchor and its value: `MRP:- ₹45`.
 * Leading separators only; the value's own punctuation is left alone.
 */
export function stripLeadingSeparators(s: string): string {
  return s.replace(/^[\s:;=.\-–—|)\]}>*]+/, '').trim();
}
