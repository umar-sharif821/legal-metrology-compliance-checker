/**
 * Synthetic OCR line sets.
 *
 * These are a **guess** at what ML Kit returns from an Indian label — written from what
 * such panels say, not from a measurement. They are enough to pin the cascade's
 * behaviour and to stop a regression, and they are not evidence that the app works.
 * That evidence comes from phase D-3, where real captures replace these one by one.
 *
 * Kept honest deliberately: the text carries the running-together, the stray
 * punctuation and the odd line breaks that real recognition produces.
 */

import type { Box, OcrLine } from './types';

/** Lay lines out in a single column so every fixture has plausible geometry. */
export function linesFrom(texts: readonly string[], lineHeight = 40): OcrLine[] {
  return texts.map((text, i) => {
    const box: Box = { x: 40, y: 60 + i * lineHeight, width: 24 * text.length, height: 32 };
    return { text, box };
  });
}

/**
 * A label carrying all six declarations, correctly formed.
 *
 * The commodity name is anchored (`Common Name:`) because the pack recovers this field
 * by anchor only. Until D-3 this fixture read plain `Glucose Biscuits` and the suite
 * still reported six declarations found — the anchor `product` was matching inside
 * `Parle Products Pvt. Ltd.` on the manufacturer line and returning `s pvt. ltd.` as
 * the commodity name. No test asserted the *value*, so a fixture that did not carry
 * this declaration at all passed a test named for carrying it. Fixed with the
 * word-boundary match in `normalise.ts`; the fixture now says what it claims to say.
 */
export const COMPLETE_LABEL: readonly string[] = [
  'PARLE-G',
  'Common Name: Glucose Biscuits',
  'Net Wt. 250 g',
  'M.R.P. Rs. 30.00',
  '(Inclusive of all taxes)',
  'Mfd. by: Parle Products Pvt. Ltd.',
  'Plot No 12, MIDC Ambad,',
  'Nashik 422010, India',
  'Consumer Care: care@parleproducts.com',
  'Mfg Date: 08/2026',
];

/** The price declaration is simply absent. */
export const NO_PRICE: readonly string[] = COMPLETE_LABEL.filter(
  (l) => !l.startsWith('M.R.P.') && !l.startsWith('(Inclusive'),
);

/** Price present, but not in the prescribed form — the tax wording is missing. */
export const PRICE_WITHOUT_TAX_WORDING: readonly string[] = COMPLETE_LABEL.filter(
  (l) => !l.startsWith('(Inclusive'),
);

/** Quantity declared as a bare number: present, but with no standard unit. */
export const QUANTITY_WITHOUT_UNIT: readonly string[] = COMPLETE_LABEL.map((l) =>
  l === 'Net Wt. 250 g' ? 'Net Wt. 250' : l,
);

/** A label with a best-before date but no date of manufacture or packing. */
export const BEST_BEFORE_ONLY: readonly string[] = COMPLETE_LABEL.map((l) =>
  l.startsWith('Mfg Date') ? 'Best Before 9 months from packaging' : l,
);

/** Front-of-pack only: branding, no declaration panel. The bad-capture case. */
export const FRONT_OF_PACK_ONLY: readonly string[] = [
  'PARLE-G',
  'Glucose',
  'Biscuits',
  'The Original',
  'Since 1929',
  'Bharat ka apna biscuit',
];

/** Barely anything read at all — a blurred or badly framed capture. */
export const NEARLY_BLANK: readonly string[] = ['PAR', '250'];

/** Anchor on one line, value on the next — exercises stage B. */
export const VALUE_ON_NEXT_LINE: readonly string[] = [
  'Tata Salt',
  'Iodised Salt',
  'Net Quantity',
  '1 kg',
  'Maximum Retail Price',
  '₹ 28.00 (inclusive of all taxes)',
  'Marketed by',
  'Tata Consumer Products Ltd, Mumbai 400001',
  'Customer Care',
  '1800 200 1234',
  'Packed on',
  'Nov 2026',
];
