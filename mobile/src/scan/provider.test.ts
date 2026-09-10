/**
 * The OCR provider registry — phase `A-0`.
 *
 * Small file, small tests, one real job: the descriptor table and the `OcrProviderId`
 * union are two lists that must stay the same list. They are separate because one is a
 * runtime value the scorer reads and the other is a compile-time type, and TypeScript
 * cannot keep them in step on its own. Drift shows up as a corpus column with no heading,
 * or an engine the compiler accepts and the report cannot name.
 */
import { describe, expect, it } from 'vitest';

import {
  PROVIDERS,
  REFERENCE_PROVIDER_ID,
  describeProvider,
  providerDescriptor,
  type OcrProviderId,
} from './provider';

describe('OCR provider registry', () => {
  it('has an entry for every id, with no duplicates', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PROVIDERS.length).toBeGreaterThan(0);
  });

  it('describes the reference provider', () => {
    // If this ever fails, the engine the app ships has no heading in the accuracy table
    // and no label in the UI — and every `expect` block's provenance becomes a guess.
    expect(describeProvider(REFERENCE_PROVIDER_ID)).not.toBeNull();
    expect(providerDescriptor(REFERENCE_PROVIDER_ID).label.length).toBeGreaterThan(0);
  });

  it('gives every provider a label and a reason for being in the table', () => {
    for (const p of PROVIDERS) {
      expect(p.label.length, `${p.id} has no label`).toBeGreaterThan(0);
      expect(p.note.length, `${p.id} has no note saying why it is here`).toBeGreaterThan(0);
      expect(['device', 'host']).toContain(p.runsOn);
    }
  });

  it('returns null for an engine it does not know, rather than inventing a label', () => {
    // A record naming an unknown engine must be refusable (P9). A fabricated label would
    // let its lines join the table as though somebody had vouched for them.
    expect(describeProvider('paddleocr')).toBeNull();
    expect(describeProvider('')).toBeNull();
  });

  it('throws rather than return a label for an id the table has lost', () => {
    // Reachable only if the union and the table drift apart. `as` is the only way to
    // express that here, and the test exists precisely because the compiler cannot.
    expect(() => providerDescriptor('nonexistent' as OcrProviderId)).toThrow(/No descriptor/);
  });
});
