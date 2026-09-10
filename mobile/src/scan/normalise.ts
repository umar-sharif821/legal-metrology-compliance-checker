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

/** Punctuation that marks the end of a printed label: `Product Name:`, `Mfd. by -`. */
const LABEL_SEPARATOR = /[:;=.\-|)\]}>*]/;

/**
 * Find an anchor term, but only where it is printed as a **label** rather than used as
 * an ordinary word in a sentence.
 *
 * `findAnchorEnd` believes an anchor wherever it appears with clean word boundaries.
 * That is right for a field whose value has a shape to verify it — `net qty` can be
 * trusted because whatever follows must still look like a quantity. It is wrong for a
 * free-text field that takes the anchor's remainder verbatim, because then *any*
 * sentence containing the anchor word yields a confident value.
 *
 * Measured on the device 2026-09-10, Bhujialalji Navratna Mix, both at **high**
 * confidence via stage A, from the `commodity_name` anchor `product`:
 *
 *  - `product of india` → commodity name `of india`
 *  - `this product is made in a facility that …` → `is made in a facility that`
 *
 * Neither is an OCR error; both lines were read correctly. The fault is treating an
 * English word in running text as a declaration label. So a labelled anchor must
 *
 *  1. begin the line — a declaration label is not buried mid-sentence; and
 *  2. be followed by a separator, or by nothing at all.
 *
 * Condition 2 admits `manufactured by` alone on its line, where the value is printed
 * below and stage B goes looking for it. It rejects `product of india`, where the
 * anchor runs straight into ordinary words.
 *
 * **The cost is real and is accepted deliberately (P3).** A label printed
 * `Product Name Navratna Mix`, with no punctuation after the anchor, is no longer
 * recovered and the declaration is reported not found. A miss produces an advisory
 * telling the officer to rescan the panel; a false value tells them the commodity is
 * called "of india". The first is cheaper, so the trade is taken — and which fields take
 * it is pack data (`anchor_must_be_labelled`), not a decision buried here.
 */
export function findLabelledAnchorEnd(line: string, anchors: readonly string[]): number {
  for (const anchor of anchors) {
    if (anchor.length === 0) continue;
    if (!line.startsWith(anchor)) continue;

    const end = anchor.length;
    // Same right-hand boundary rule as findAnchorEnd: required only when the anchor
    // itself ends in a letter or digit, so `mfd.` may butt up against what follows.
    if (isAlphanumeric(anchor[end - 1]) && isAlphanumeric(line[end])) continue;

    let at = end;
    while (line[at] === ' ') at++;
    if (at >= line.length) return end; // anchor alone on its line — stage B's job
    if (LABEL_SEPARATOR.test(line[at] as string)) return end;
  }
  return -1;
}
