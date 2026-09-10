import { describe, expect, it } from 'vitest';

import rawPack from '../rulepack/demo-lmpc-v0.json';
import { compilePack, DEMO_PACK } from '../rulepack/pack';
import { extract } from './extract';
import * as fx from './fixtures';
import { normaliseLine } from './normalise';
import type { ExtractedField } from './types';

function run(texts: readonly string[]) {
  const result = extract(DEMO_PACK, fx.linesFrom(texts));
  const byId = new Map(result.fields.map((f) => [f.fieldId, f]));
  return { result, byId, get: (id: string): ExtractedField | undefined => byId.get(id) };
}

describe('normalisation', () => {
  it('folds every rupee spelling to the sign, dot included', () => {
    // The dot matters: `Rs. 30` normalising to `₹. 30` silently breaks every price shape.
    expect(normaliseLine('M.R.P. Rs. 30.00')).toContain('₹ 30.00');
    expect(normaliseLine('MRP RS 30')).toContain('₹ 30');
    expect(normaliseLine('INR 30')).toContain('₹ 30');
    expect(normaliseLine('₨ 30')).toContain('₹ 30');
  });

  it('collapses whitespace and lower-cases without dropping content', () => {
    expect(normaliseLine('  Net   Wt.\t250 g  ')).toBe('net wt. 250 g');
  });

  it('leaves a line with nothing to fold untouched apart from case', () => {
    expect(normaliseLine('Glucose Biscuits')).toBe('glucose biscuits');
  });
});

describe('extraction cascade', () => {
  it('recovers all six declarations from a complete label', () => {
    const { result } = run(fx.COMPLETE_LABEL);
    expect(result.fields.map((f) => f.fieldId).sort()).toEqual([
      'commodity_name',
      'consumer_care',
      'date_of_packing',
      'manufacturer_address',
      'net_quantity',
      'retail_sale_price',
    ]);
  });

  it('reads the values a person would read', () => {
    const { get } = run(fx.COMPLETE_LABEL);
    expect(get('net_quantity')?.value).toBe('250 g');
    expect(get('retail_sale_price')?.value).toBe('30.00');
    expect(get('date_of_packing')?.value).toBe('08/2026');
    expect(get('consumer_care')?.value).toBe('care@parleproducts.com');
  });

  it('shows the whole line for a free-text declaration, not just what the shape matched', () => {
    // The shape finds the PIN code; an officer needs the address.
    const { get } = run(fx.COMPLETE_LABEL);
    const mfr = get('manufacturer_address');
    expect(mfr?.value).toContain('parle products');
    expect(mfr?.value).not.toBe('422010');
  });

  it('marks an anchored inline match as stage A', () => {
    const { get } = run(fx.COMPLETE_LABEL);
    expect(get('retail_sale_price')?.stage).toBe('A_anchored_inline');
    expect(get('retail_sale_price')?.confidence).toBe('high');
  });

  it('reaches a value on the line below its anchor, at lower confidence', () => {
    const { get } = run(fx.VALUE_ON_NEXT_LINE);
    const qty = get('net_quantity');
    expect(qty?.value).toBe('1 kg');
    expect(qty?.stage).toBe('B_anchored_adjacent');
    expect(qty?.confidence).toBe('medium');

    expect(get('consumer_care')?.value).toBe('1800 200 1234');
    expect(get('date_of_packing')?.value).toBe('nov 2026');
  });

  it('recovers a distinctively shaped value with no anchor at all, at low confidence', () => {
    const { get } = run(['SOME BRAND', 'a line', '₹ 99.00', 'another line', 'and another']);
    const price = get('retail_sale_price');
    // Unanchored recovery uses the strict shape, which includes the currency marker —
    // and showing `₹ 99.00` rather than a bare `99.00` is what makes it checkable.
    expect(price?.value).toBe('₹ 99.00');
    expect(price?.stage).toBe('C_shape_only');
    expect(price?.confidence).toBe('low');
  });

  it('refuses to guess a free-text declaration with no anchor', () => {
    // An address is not recoverable from shape alone: a PIN-looking number could be a
    // batch code. The pack marks the field unanchored_recovery:false and it stays absent.
    const { get } = run(['SOME BRAND', 'tasty snack', 'nashik 422010', 'x', 'y', 'z']);
    expect(get('manufacturer_address')).toBeUndefined();
  });

  it('recovers a quantity that carries no unit, rather than reporting it absent', () => {
    const { get } = run(fx.QUANTITY_WITHOUT_UNIT);
    const qty = get('net_quantity');
    expect(qty).toBeDefined();
    expect(qty?.value).toBe('250');
  });

  // ---- D-3 field-trial regressions ---------------------------------------
  //
  // Each of these pins a defect measured on a real packet. The corpus in
  // `field-trial/` catches them too, but it is two records of one packet; these say
  // what the rule is, in terms that do not depend on that packet still being there.

  it('does not match an anchor inside a longer word', () => {
    // Measured on record 001: the `commodity_name` anchor `product` matched inside
    // `cereal products` on the INGREDIENTS line and, because that field takes the
    // anchor's remainder as its value, returned the leftover of the word as a HIGH
    // confidence commodity name. A confident wrong value is the expensive error (P3).
    const { get } = run([
      'SOME BRAND',
      'INGREDIENTS: Cereal Products (6779%) (Rice Meal (44%),',
      'and Condiments, Iodised Salt, Sugar,',
      'Mfd. by: Parle Products Pvt. Ltd.',
      'Nashik 422010, India',
      'Net Wt. 250 g',
    ]);
    expect(get('commodity_name')).toBeUndefined();
  });

  it('still matches an anchor that runs into its own punctuation', () => {
    // The other half of the same rule: the boundary is only required where the anchor
    // itself ends in a letter or digit. `net qty.` ends in a dot and must still match
    // `NET QTY.: 250 g`, which a `\b`-delimited regex would refuse.
    const { get } = run(['SOME BRAND', 'NET QTY.: 250 g', 'a', 'b', 'c', 'd']);
    expect(get('net_quantity')?.value).toBe('250 g');
    expect(get('net_quantity')?.stage).toBe('A_anchored_inline');
  });

  it('will not pair an anchor with a value printed above it', () => {
    // Measured on record 001: `NET QTY:` (list index 30, y=3365) was paired with
    // `Pee 100g` (index 31, y=1697) — the nutrition table's "Per 100 g", most of a
    // panel higher up — and reported as the net quantity at medium confidence. Stage B
    // claims the value sits *below* the anchor; before D-3 it never checked.
    // The anchor comes first in the list, so list order offers `Per 100 g` as its
    // value — but that line is printed 800 px higher up the label.
    const result = extract(DEMO_PACK, [
      { text: 'NET QTY:', box: { x: 942, y: 1000, width: 263, height: 118 } },
      { text: 'Per 100 g', box: { x: 1787, y: 200, width: 160, height: 77 } },
    ]);
    expect(result.fields.find((f) => f.fieldId === 'net_quantity')).toBeUndefined();
  });

  it('still pairs an anchor with the value below it', () => {
    // The control for the test above: same shapes, geometry the other way round.
    const result = extract(DEMO_PACK, [
      { text: 'NET QTY:', box: { x: 942, y: 1000, width: 263, height: 118 } },
      { text: '84.9 g', box: { x: 942, y: 1140, width: 200, height: 110 } },
    ]);
    const qty = result.fields.find((f) => f.fieldId === 'net_quantity');
    expect(qty?.value).toBe('84.9 g');
    expect(qty?.stage).toBe('B_anchored_adjacent');
  });

  // ---- A-4 spatial association -------------------------------------------
  //
  // `associate.test.ts` pins the geometry itself. These say what the cascade does with
  // it, on the shapes a real label produces.

  it('reaches a value printed beside its anchor, not just below it', () => {
    // The defect A-4 exists to fix, stated without the corpus. Measured on record 002:
    // `NET QTY:` is OCR line 30 and its value `84.9g` is line 49 — nineteen entries away
    // in reading order, and printed 322 px to its right on the same (slightly tilted)
    // row. Every number needed to pair them was in the record; list order threw it away.
    // The interleaved lines are the rest of the panel's two columns, which is exactly
    // what put nineteen entries between the two in the first place.
    const result = extract(DEMO_PACK, [
      { text: 'UNIT SALE PRICE:', box: { x: 921, y: 2477, width: 424, height: 193 } },
      { text: 'NO. OFSERVES', box: { x: 918, y: 2615, width: 371, height: 174 } },
      { text: 'PER PACK/ B. NO.:', box: { x: 919, y: 2705, width: 462, height: 141 } },
      { text: 'MFD & USE BY:', box: { x: 885, y: 2843, width: 428, height: 154 } },
      { text: 'NET QTY:', box: { x: 886, y: 3013, width: 267, height: 123 } },
      { text: 'Rs.0.24 /-ER9 o5', box: { x: 1395, y: 2592, width: 425, height: 65 } },
      { text: '4.2/RP 25U826 #', box: { x: 1405, y: 2653, width: 369, height: 128 } },
      { text: '25/08/23 & 22/DV27', box: { x: 1419, y: 2764, width: 461, height: 120 } },
      { text: '84.9g 78 +i)', box: { x: 1475, y: 2868, width: 419, height: 169 } },
    ]);
    const qty = result.fields.find((f) => f.fieldId === 'net_quantity');
    expect(qty?.value).toBe('84.9g');
    expect(qty?.stage).toBe('B_anchored_adjacent');
    expect(qty?.association?.direction).toBe('right');
  });

  it('carries the geometry that chose a value, so a person can check the pairing', () => {
    // P7: the officer is shown *why* this line was read as the label's value — 2.6 of the
    // label's own text heights to its right — and can disagree by looking at the frame.
    const result = extract(DEMO_PACK, [
      { text: 'NET QTY:', box: { x: 886, y: 3013, width: 267, height: 123 } },
      { text: '84.9g', box: { x: 1475, y: 2868, width: 419, height: 169 } },
    ]);
    const assoc = result.fields.find((f) => f.fieldId === 'net_quantity')?.association;
    expect(assoc?.direction).toBe('right');
    expect(assoc?.gapHeights).toBe(2.62);
    // Nothing else was in either neighbourhood, so there was no runner-up to beat.
    expect(assoc?.runnerUpScore).toBeNull();
  });

  it('says nothing when two lines are equally plausible values for one anchor', () => {
    // A promotional pack with two quantities printed symmetrically about the label. The
    // geometry does not answer, so neither does the app: a missing declaration is an
    // advisory saying "rescan", where the wrong one is a confident falsehood (P3).
    const result = extract(DEMO_PACK, [
      { text: 'NET QTY:', box: { x: 1000, y: 1000, width: 300, height: 100 } },
      { text: '250 g', box: { x: 1000, y: 1140, width: 300, height: 100 } },
      { text: '400 g', box: { x: 1400, y: 1000, width: 300, height: 100 } },
    ]);
    expect(result.fields.find((f) => f.fieldId === 'net_quantity')).toBeUndefined();
  });

  it('does not pair an anchor with a value printed in the next column down', () => {
    // Directly below in reading order and within reach, but offset far enough sideways
    // that it belongs to a different column of the panel.
    const result = extract(DEMO_PACK, [
      { text: 'NET QTY:', box: { x: 1000, y: 1000, width: 300, height: 100 } },
      { text: '250 g', box: { x: 1290, y: 1140, width: 400, height: 100 } },
    ]);
    expect(result.fields.find((f) => f.fieldId === 'net_quantity')).toBeUndefined();
  });

  it('reads the same label the same way from a different distance', () => {
    // Every threshold is in multiples of the anchor's own text height precisely so that
    // this holds. Two captures of one packet from 15 cm and 30 cm are the same geometry
    // at different pixel scales, and must not disagree about what the label says.
    const at = (k: number) =>
      extract(DEMO_PACK, [
        { text: 'NET QTY:', box: { x: 886 * k, y: 3013 * k, width: 267 * k, height: 123 * k } },
        { text: '84.9g', box: { x: 1475 * k, y: 2868 * k, width: 419 * k, height: 169 * k } },
      ]).fields.find((f) => f.fieldId === 'net_quantity');
    expect(at(2)?.value).toBe(at(1)?.value);
    expect(at(2)?.association).toEqual(at(1)?.association);
  });

  it('falls back to reading order when the engine gave the anchor no box', () => {
    // Geometry cannot be consulted, so the pre-A-4 behaviour is used rather than the
    // field being dropped — and `association: null` is how a reader tells that this
    // pairing rests on list order, not on where anything was printed (P9).
    const result = extract(DEMO_PACK, [
      { text: 'NET QTY:', box: null },
      { text: '250 g', box: null },
    ]);
    const qty = result.fields.find((f) => f.fieldId === 'net_quantity');
    expect(qty?.value).toBe('250 g');
    expect(qty?.stage).toBe('B_anchored_adjacent');
    expect(qty?.association).toBeNull();
  });

  it('does not recover a quantity from its shape alone', () => {
    // Measured on record 002: shape-only recovery returned `15.1g`, read out of the
    // FSSAI food-category code in `PROPRIETARY FOOD--NAMKEEN(15.1)`. A number with a
    // mass unit is not distinctive on a food label — a nutrition panel is full of them.
    // The pack now marks the field `unanchored_recovery: false`.
    const { get } = run(['SOME BRAND', 'a line', '250 g', 'another line', 'x', 'y']);
    expect(get('net_quantity')).toBeUndefined();
  });

  it('does not accept a best-before date as the date of manufacture', () => {
    const { get } = run(fx.BEST_BEFORE_ONLY);
    expect(get('date_of_packing')).toBeUndefined();
  });

  it('does not read a price as a date', () => {
    // `5.00` must not parse as month 5 of year 00.
    const { get } = run(['BRAND', 'a', 'b', 'MRP ₹ 5.00', 'c', 'd']);
    expect(get('date_of_packing')).toBeUndefined();
  });

  it('finds nothing to declare on a front-of-pack capture', () => {
    const { result } = run(fx.FRONT_OF_PACK_ONLY);
    expect(result.fields.length).toBeLessThanOrEqual(1);
  });

  it('carries an evidence box for every value it found', () => {
    const { result } = run(fx.COMPLETE_LABEL);
    for (const f of result.fields) {
      expect(f.box, `${f.fieldId} has no evidence region`).not.toBeNull();
    }
  });

  it('reports null geometry rather than inventing a box when the engine gives none', () => {
    const lines = fx.COMPLETE_LABEL.map((text) => ({ text, box: null }));
    const result = extract(DEMO_PACK, lines);
    expect(result.fields.length).toBeGreaterThan(0);
    for (const f of result.fields) expect(f.box).toBeNull();
  });

  it('is a pure function of its input', () => {
    const lines = fx.linesFrom(fx.COMPLETE_LABEL);
    const a = extract(DEMO_PACK, lines);
    const b = extract(DEMO_PACK, lines);
    expect(a.fields).toEqual(b.fields);
  });
});

describe('an anchor printed as a label, versus the same word in a sentence', () => {
  // Every line here was read correctly by ML Kit on the Nord 4, 2026-09-10, from the
  // Bhujialalji Navratna Mix packet. The bug was never the OCR; it was believing the
  // word `product` wherever it appeared. Both of these reached the screen as
  // `commodity_name` at HIGH confidence before `anchor_must_be_labelled`.
  const PRODUCT_OF_INDIA = 'PRODUCT OF INDIA';
  const ALLERGEN_SENTENCE = 'This product is made in a facility that also processes Peanut';

  it('does not name the commodity from "PRODUCT OF INDIA"', () => {
    expect(run([PRODUCT_OF_INDIA]).get('commodity_name')).toBeUndefined();
  });

  it('does not name the commodity from the allergen sentence', () => {
    expect(run([ALLERGEN_SENTENCE]).get('commodity_name')).toBeUndefined();
  });

  it('still reads a genuine label, with or without the word "name"', () => {
    expect(run(['Product Name: Navratna Mix']).get('commodity_name')?.value).toBe('navratna mix');
    expect(run(['PRODUCT: Navratna Mix']).get('commodity_name')?.value).toBe('navratna mix');
    // A separator other than a colon is still a label.
    expect(run(['Commodity - Navratna Mix']).get('commodity_name')?.value).toBe('navratna mix');
  });

  it('prefers silence over a guess when the label carries no punctuation', () => {
    // The accepted cost, pinned so nobody "fixes" it by loosening the rule without
    // reading why it is here. Not found raises a rescan advisory; `of india` does not.
    expect(run(['Product Name Navratna Mix']).get('commodity_name')).toBeUndefined();
  });

  it('leaves a field that did not ask for the rule alone', () => {
    // `manufacturer_address` sets the flag false, so its anchors are still believed
    // mid-line. That is the pack's call to make and this test only records it.
    expect(DEMO_PACK.fieldById('manufacturer_address')?.anchorMustBeLabelled).toBe(false);
    expect(run(['Film manufactured by: GLS Films Industries']).get('manufacturer_address')).toBeDefined();
  });

  it('takes the rule from the pack, so it is a data decision', () => {
    // P6: flip the flag in the data and the same line changes answer, with no code edit.
    const relaxed = structuredClone(rawPack) as {
      fields: { id: string; anchor_must_be_labelled?: boolean }[];
    };
    const field = relaxed.fields.find((f) => f.id === 'commodity_name');
    if (field === undefined) throw new Error('commodity_name missing from the pack');
    field.anchor_must_be_labelled = false;

    const loose = extract(compilePack(relaxed), fx.linesFrom([PRODUCT_OF_INDIA]));
    const found = loose.fields.find((f) => f.fieldId === 'commodity_name');
    expect(found?.value).toBe('of india');
  });

  it('refuses a pack that leaves the choice unstated for a free-text field', () => {
    // No default in code: a field that takes the anchor remainder verbatim must say
    // out loud whether a mid-sentence anchor counts.
    const silent = structuredClone(rawPack) as {
      fields: { id: string; anchor_must_be_labelled?: boolean }[];
    };
    const field = silent.fields.find((f) => f.id === 'commodity_name');
    if (field === undefined) throw new Error('commodity_name missing from the pack');
    delete field.anchor_must_be_labelled;

    expect(() => compilePack(silent)).toThrow(/anchor_must_be_labelled/);
  });
});
