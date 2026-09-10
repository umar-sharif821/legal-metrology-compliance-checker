/**
 * Replay of the `D-3` field-trial corpus, per OCR engine.
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
 * **`A-0` split assertion from measurement, and the split is the point.** A record now
 * holds one reading per engine that has read its image. The *reference* engine — the one
 * the app ships, and the one whose output every `expect` block was written while reading
 * — is **asserted**: if it regresses, the suite reds. Every other engine is **measured**
 * and reported, never asserted. A candidate engine disagreeing with a reviewer's block is
 * a number for the table, not a broken build; treating it as a failure would make adding
 * an engine an act of breaking the suite, which is precisely the friction `A-0` exists to
 * remove. Nothing below names an engine, so adding one needs no change here.
 *
 * `node:fs` lives here and nowhere else in `src/`: this file is test-only and Metro never
 * sees it, so the app bundle stays free of a Node import.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEMO_PACK } from '../rulepack/pack';
import { evaluate } from '../verdict/evaluate';
import { extract } from './extract';
import { PROVIDERS, REFERENCE_PROVIDER_ID, describeProvider } from './provider';
import { RECORD_SCHEMA_ID, type FieldTrialRecord } from './recordTypes';
import { formatReport, readingFrame, scoreCorpus, type CorpusEntry } from './score';
import type { CaptureSource } from './types';

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'field-trial');

/**
 * How many records `D-3` will ever hold, named here so the shortfall is visible in the run.
 *
 * **Four, not the plan's ten** — user decision, 2026-09-10: only two packaged products are
 * available to photograph. The corpus is therefore two products in two capture kinds
 * (`docs/PROGRESS.md`, Decisions log). The plan's ten was a round number, and the board's
 * real stopping rule was always *when a new packet stops breaking something new*; this is
 * that rule meeting the supply of packets rather than a target being quietly lowered.
 *
 * The consequence is permanent and belongs with every claim: nothing here is tuned against
 * a corpus, and no accuracy figure drawn from it generalises past two labels (P8).
 */
const TARGET_PACKETS = 4;

/** Every provenance a record may declare. Kept in step with `CaptureSource` by the compiler. */
const KNOWN_SOURCES: readonly CaptureSource[] = ['viewfinder', 'still', 'upload'];

function loadCorpus(): CorpusEntry[] {
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
        expect(record.readings.length).toBeGreaterThan(0);
        for (const reading of record.readings) {
          expect(reading.lines.length).toBeGreaterThan(0);
        }
      });

      it('attributes every line set to an engine this build knows', () => {
        // An unattributed or unknown line set is not a measurement — nobody reading the
        // table later can say what produced it, and it would silently join a column it
        // may not belong in (P8). Adding an engine to `PROVIDERS` is the fix, not
        // loosening this.
        for (const reading of record.readings) {
          expect(
            describeProvider(reading.provider),
            `${file} holds a reading by "${String(reading.provider)}", which is not in ` +
              `PROVIDERS. Add it to scan/provider.ts before committing its lines.`,
          ).not.toBeNull();
        }
      });

      it('names one engine per reading, and no engine twice', () => {
        const ids = record.readings.map((r) => r.provider);
        expect(new Set(ids).size, `${file} has two readings by the same engine`).toBe(ids.length);
      });

      it('says which reading the device itself took', () => {
        // `extracted`, `verdict` and the extract/evaluate timings describe exactly one
        // reading. Which one has to be stated, or a host replay's numbers and a phone's
        // become indistinguishable (P8).
        expect(
          record.readings.map((r) => r.provider),
          `${file} declares recordedProvider "${String(record.recordedProvider)}" with no ` +
            `matching reading`,
        ).toContain(record.recordedProvider);
      });

      it('says what kind of image it was read from', () => {
        // `C-0` made the corpus able to hold three different measurements of a label —
        // an unprocessed viewfinder frame, a full-quality still, and a stock-camera photo
        // — and they do not produce the same lines. A record that does not say which it
        // is cannot be compared with anything, so it fails here rather than sitting in the
        // corpus looking usable (P8).
        expect(
          KNOWN_SOURCES,
          `${file} declares source "${String(record.source)}", which this suite does not know.`,
        ).toContain(record.source);
      });

      it('reports a capture time only where one exists', () => {
        // An upload has no shutter this app timed. A number there would be invented, and
        // it would silently join any latency average taken over the corpus (P4).
        if (record.source === 'upload') {
          expect(
            record.timings.captureMs,
            `${file} is an upload and cannot have a capture time`,
          ).toBeNull();
        } else {
          expect(record.timings.captureMs, `${file}`).toBeTypeOf('number');
        }
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

      const reference = record.readings.find((r) => r.provider === REFERENCE_PROVIDER_ID);

      if (!reference) {
        // Not a skip. The shipped engine having no reading for a committed packet means
        // the record was written by something that is not this app, and the assertions
        // below would silently stop running (P9).
        it('has a reading by the engine the app ships', () => {
          expect(
            reference,
            `${file} has no ${REFERENCE_PROVIDER_ID} reading, so nothing in it is asserted.`,
          ).toBeDefined();
        });
        return;
      }

      it('extracts the fields the reviewer expects', () => {
        const extraction = extract(DEMO_PACK, reference.lines);
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
        const extraction = extract(DEMO_PACK, reference.lines);
        const verdict = evaluate(DEMO_PACK, readingFrame(reference), extraction);

        expect(verdict.status).toBe(expected.status);
        expect([...verdict.findings.map((f) => f.declarationId)].sort()).toEqual(
          [...expected.findings].sort(),
        );
      });
    });
  }

  describe('A-0 per-provider accuracy', () => {
    const scores = scoreCorpus(
      DEMO_PACK,
      corpus,
      PROVIDERS.map((p) => p.id),
    );

    it('prints the per-provider table', () => {
      // The report is the deliverable, not the assertion. `A-0` exists so an accuracy
      // claim is a number somebody measured (P8); printing it on every run is how the
      // number stays current instead of being quoted from a session six weeks old.
      // eslint-disable-next-line no-console
      console.log(formatReport(scores, corpus));
      expect(scores.length).toBe(PROVIDERS.length);
    });

    it('reports an engine with no line set as not measured, never as zero', () => {
      for (const score of scores) {
        if (score.measured > 0) continue;
        expect(score.precision, `${score.label} has no readings and must not report a rate`).toBe(
          null,
        );
        expect(score.recall).toBe(null);
        expect(score.notMeasured).toBe(corpus.length);
      }
    });

    it('measures the shipped engine on every reviewed packet', () => {
      // The reference column is the one that must always be populated: it is the engine
      // the app runs, and an empty column there would mean the table below it is measuring
      // candidates against nothing.
      const reference = scores.find((s) => s.isReference);
      const reviewed = corpus.filter((entry) => entry.record.expect).length;
      expect(reference, 'no score row for the reference provider').toBeDefined();
      expect(reference?.measured).toBe(reviewed);
    });
  });
});
