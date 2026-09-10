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
 * Characters that make an anchor run into a neighbouring word.
 *
 * Letters and digits in any script, so this stays correct when Devanagari OCR is turned
 * on. Punctuation, spaces and symbols are all treated as boundaries.
 */
const ALPHANUMERIC = /[\p{L}\p{N}]/u;

function isAlphanumeric(ch: string | undefined): boolean {
  return ch !== undefined && ALPHANUMERIC.test(ch);
}

/**
 * Find an anchor term in a normalised line.
 *
 * Returns the index just past the anchor, so the caller can take the remainder of the
 * line as the candidate value — or `-1` when no anchor matches. Anchors are expected
 * pre-sorted longest-first by the pack loader, so the most specific one wins.
 *
 * Matching is **not** a plain substring search, and **not** a `\b` word-boundary regex
 * either. Neither works on real labels:
 *
 *  - A plain `indexOf` matches an anchor inside a longer word. Measured in D-3: the
 *    `commodity_name` anchor `product` matched inside `ingredients: cereal products
 *    (6779%) …` and, because that field takes the anchor's remainder as its value,
 *    reported the commodity name as `s (6779%) (rice meal (44%),` at **high** confidence.
 *    A confident wrong value is the expensive error (P3).
 *  - A `\b`-delimited regex fails the opposite way, because anchors carry their own
 *    punctuation: `net qty.` ends in a dot, and `\bnet qty\.\b` cannot match
 *    `net qty.: 250 g` — there is no word boundary between `.` and `:`.
 *
 * So the boundary is required only on the sides where the anchor itself ends in a
 * letter or digit. `product` may not be followed by one; `m.r.p.` and `net qty.` end in
 * punctuation and are free to butt up against whatever follows. Every occurrence in the
 * line is tried, not just the first, so `dairy products … product: namkeen` still
 * matches at the second.
 */
export function findAnchorEnd(line: string, anchors: readonly string[]): number {
  for (const anchor of anchors) {
    if (anchor.length === 0) continue;
    const boundedLeft = isAlphanumeric(anchor[0]);
    const boundedRight = isAlphanumeric(anchor[anchor.length - 1]);

    for (let at = line.indexOf(anchor); at !== -1; at = line.indexOf(anchor, at + 1)) {
      const end = at + anchor.length;
      if (boundedLeft && isAlphanumeric(line[at - 1])) continue;
      if (boundedRight && isAlphanumeric(line[end])) continue;
      return end;
    }
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
