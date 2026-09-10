import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { NAV_BAR_INSET } from './layout';

/**
 * Guard for the defect this module was extracted to prevent.
 *
 * `C-0` shipped *Use a photo from the gallery* on a control block anchored with a bare
 * `bottom: 36`. Android 15 forces edge-to-edge, so on the Nord 4 (density 480, so the
 * three-button bar owns the lowest 144 px) the link's lower third sat inside the
 * navigation bar's touch region: a tap aimed at it reached HOME instead, and the upload
 * path could not be exercised at all. `VerdictScreen` had reserved the inset; `ScanScreen`
 * had not, because the constant was declared privately in the file that got it right.
 *
 * The structural fix is the shared module. This is the part a reviewer cannot forget: any
 * absolutely bottom-anchored offset in the app must add `NAV_BAR_INSET`, or flush itself
 * to `bottom: 0` and deal with the bar deliberately.
 */
const SRC = join(__dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') || path.endsWith('.ts') ? [path] : [];
  });
}

describe('bottom-anchored controls reserve the navigation bar', () => {
  it('is a positive number of dp', () => {
    expect(NAV_BAR_INSET).toBeGreaterThan(0);
  });

  it('every `bottom:` offset in the app adds NAV_BAR_INSET or is flush at 0', () => {
    const offenders: string[] = [];

    for (const file of tsxFiles(SRC)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const source = readFileSync(file, 'utf8');

      // `bottom: <number>` in a style object. `bottom: 0` is a deliberate flush edge and
      // needs no room; anything else must add the inset in the same expression.
      for (const match of source.matchAll(/\bbottom:\s*([^,\n}]+)/g)) {
        const value = match[1]?.trim() ?? '';
        if (!/^\d/.test(value)) continue; // not a numeric literal offset
        if (value === '0') continue;
        if (value.includes('NAV_BAR_INSET')) continue;
        offenders.push(`${file}: bottom: ${value}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
