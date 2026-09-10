import { describe, expect, it } from 'vitest';
import { splitByGaps, type Word } from './lines';

/** Word boxes as Tesseract actually reported them for the reproduction image. */
const word = (text: string, x0: number, x1: number, y0 = 85, y1 = 104): Word => ({
  text,
  box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
});

describe('splitByGaps', () => {
  it('splits the merge that produced the false manufacturer', () => {
    // Measured from the reproduction: word gaps ~10px, the bogus join ~257px,
    // against a text height of ~19px.
    const words = [
      word('Marketed', 22, 127),
      word('by:', 137, 168, 85, 109),
      word('Verka', 177, 243),
      word('Milk', 253, 297),
      word('Plant', 307, 364),
      word('SERVE', 621, 707),
      word('CHILLED', 716, 824),
    ];

    const out = splitByGaps('Marketed by: Verka Milk Plant SERVE CHILLED', words);

    expect(out.map((l) => l.text)).toEqual(['Marketed by: Verka Milk Plant', 'SERVE CHILLED']);
    // The anchor's line must no longer carry the other block's text as its value.
    expect(out[0]?.text).not.toContain('SERVE');
  });

  it('leaves an ordinary line alone', () => {
    const words = [
      word('Net', 20, 60),
      word('Quantity:', 70, 170),
      word('350', 180, 220),
      word('ml', 230, 255),
    ];
    const out = splitByGaps('Net Quantity: 350 ml', words);
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe('Net Quantity: 350 ml');
  });

  it('unions the boxes of the words it keeps together', () => {
    const out = splitByGaps('a b', [word('a', 10, 30), word('b', 40, 60)]);
    expect(out[0]?.box).toEqual({ x: 10, y: 85, width: 50, height: 19 });
  });

  it('returns the line untouched when any word has no geometry', () => {
    const words: Word[] = [word('Marketed', 22, 127), { text: 'by:', box: null }];
    const out = splitByGaps('Marketed by:', words);
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe('Marketed by:');
  });

  it('drops an empty line rather than emitting a blank one', () => {
    expect(splitByGaps('   ', [])).toEqual([]);
  });

  it('never joins two lines — output count is at least one per input run', () => {
    const far = [word('A', 0, 20), word('B', 500, 520), word('C', 1000, 1020)];
    expect(splitByGaps('A B C', far)).toHaveLength(3);
  });
});
