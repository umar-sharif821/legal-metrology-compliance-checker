/**
 * Replay of the `D-3` field-trial corpus.
 *
 * `docs/DEMO_PLAN.md` §4 D-3: *"Add each real line set to the test fixtures as it is
 * found, so tuning cannot regress an earlier packet."* This file is the mechanism that
 * makes that sentence enforceable rather than a good intention.
 *
 * Every record under `mobile/field-trial/` holds the raw OCR lines a real packet
 * produced. Those lines are a **measurement** — the packet is back on a shelf and cannot
 * be re-scanned identically — so they are replayed through the same pure `extract` →
 * `evaluate` path the device runs, and checked against an `expect` block a person wrote
 * after looking at the packet.
 *
 * **A record with no `expect` block fails the suite.** That is deliberate, and it is the
 * same rule the CI gates follow (`docs/PROGRESS.md`, 2026-09-10): a check that cannot
 * run yet is never silently green. Pulling a record therefore reds `npm test` until
 * somebody has actually looked at what the app made of that packet — which is the entire
 * work of D-3, and exactly the step that gets skipped when nothing insists on it.
 *
 * `node:fs` lives here and nowhere else in `src/`: this file is test-only and Metro never
 * sees it, so the app bundle stays free of a Node import.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEMO_PACK } from '../rulepack/pack';
import { extract } from './extract';
import { RECORD_SCHEMA_ID, type FieldTrialRecord } from './recordTypes';
import { evaluate } from '../verdict/evaluate';

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'field-trial');

/** The ten packets D-3 calls for. Named here so the shortfall is visible in the report. */
const TARGET_PACKETS = 10;

function loadCorpus(): { readonly file: string; readonly record: FieldTrialRecord }[] {
  let names: string[];
  try {
    names = readdirSync(CORPUS_DIR)
      .filter((n) => n.endsWith('.json'))
      .sort();
  } catch {
    // The directory is committed with a README, so this only happens on a broken checkout.
    return [];
  }
  return names.map((file) => ({
    file,
    record: JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8')) as FieldTrialRecord,
  }));
}

const corpus = loadCorpus();

describe('D-3 field-trial corpus', () => {
  it(`reports how far the trial has got (${corpus.length}/${TARGET_PACKETS} packets)`, () => {
    // Not an assertion that the trial is finished — D-3 is finished when a person says
    // ten packets scan sensibly. This exists so the count appears in every test run
    // rather than having to be remembered.
    expect(corpus.length).toBeGreaterThanOrEqual(0);
  });

  if (corpus.length === 0) {
    it.skip('replays each recorded packet — no packets recorded yet', () => {});
    return;
  }

  for (const { file, record } of corpus) {
    describe(`${file} — ${record.packet}`, () => {
      it('is a record this suite understands', () => {
        expect(record.schema).toBe(RECORD_SCHEMA_ID);
        expect(record.lines.length).toBeGreaterThan(0);
      });

      it('has been reviewed by a person', () => {
        expect(
          record.expect,
          `${file} has no "expect" block. Open it, read the lines the packet actually ` +
            `produced, decide what the app should make of them, and write the block. ` +
            `An unreviewed packet is not a fixture.`,
        ).toBeDefined();
      });

      if (!record.expect) return;
      const expected = record.expect;

      it('extracts the fields the reviewer expects', () => {
        const extraction = extract(DEMO_PACK, record.lines);
        const actual = new Map(extraction.fields.map((f) => [f.fieldId, f.value]));

        for (const [fieldId, want] of Object.entries(expected.fields)) {
          if (want === null) {
            // A field the reviewer decided must NOT be recovered from this packet — the
            // `commodity_name: "may differ."` case (P3: a confident wrong value is worse
            // than none).
            expect(actual.get(fieldId), `${fieldId} should not be extracted`).toBeUndefined();
          } else {
            expect(actual.get(fieldId), `${fieldId}`).toBe(want);
          }
        }
      });

      it('reaches the verdict the reviewer expects', () => {
        const extraction = extract(DEMO_PACK, record.lines);
        const verdict = evaluate(DEMO_PACK, syntheticFrame(record), extraction);

        expect(verdict.status).toBe(expected.status);
        expect([...verdict.findings.map((f) => f.declarationId)].sort()).toEqual(
          [...expected.findings].sort(),
        );
      });
    });
  }
});

/**
 * Rebuild the `OcrFrame` the device evaluated, from what the record kept.
 *
 * `ocrMs` is the recorded measurement; the evaluator does not read it, but carrying the
 * real number rather than a zero keeps the replayed verdict honest if it ever does (P8).
 */
function syntheticFrame(record: FieldTrialRecord) {
  return {
    lines: record.lines,
    imageWidth: record.frame.imageWidth,
    imageHeight: record.frame.imageHeight,
    coordinatesTransposed: record.frame.coordinatesTransposed,
    ocrMs: record.timings.ocrMs,
  };
}
