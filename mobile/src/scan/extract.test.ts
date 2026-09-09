import { describe, expect, it } from 'vitest';

import { DEMO_PACK } from '../rulepack/pack';
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
