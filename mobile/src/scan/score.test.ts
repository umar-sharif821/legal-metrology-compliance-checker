/**
 * The corpus scorer's arithmetic — phase `A-0`.
 *
 * `corpus.test.ts` runs the scorer over two real packets, which tells you it does not
 * crash and roughly what it says. It cannot tell you that a false flag lands in the
 * `wrong` column rather than the `missed` one, because the real corpus does not currently
 * produce one. So the arithmetic is pinned here, on records built for the purpose.
 *
 * That separation matters more than usual: this module produces the number the project's
 * accuracy claim rests on (**P8**), and a scorer that quietly counts a miss as a hit
 * would make every later comparison meaningless while looking perfectly healthy.
 */
import { describe, expect, it } from 'vitest';

import { DEMO_PACK } from '../rulepack/pack';
import { REFERENCE_PROVIDER_ID } from './provider';
import type { FieldTrialRecord, TrialExpectation, TrialReading } from './recordTypes';
import {
  addTallies,
  correctOf,
  emitted,
  expectedOf,
  formatReport,
  scoreCorpus,
  wrongOf,
  type PacketTally,
} from './score';

const EMPTY: PacketTally = {
  valuesExpected: 0,
  valuesCorrect: 0,
  valuesWrong: 0,
  valuesMissed: 0,
  falseValues: 0,
  withheld: 0,
  findingsExpected: 0,
  findingsCorrect: 0,
  findingsMissed: 0,
  falseFindings: 0,
  statusMatches: true,
};

function tally(partial: Partial<PacketTally>): PacketTally {
  return { ...EMPTY, ...partial };
}

/**
 * A record whose reading is a single hand-written line set.
 *
 * Deliberately not a real packet: these tests are about the counting, and a fixture drawn
 * from the corpus would make them fail whenever the extractor legitimately changes.
 */
function record(
  provider: string,
  lines: readonly string[],
  want: TrialExpectation | undefined,
): FieldTrialRecord {
  const reading: TrialReading = {
    provider,
    readAt: '2026-09-10T00:00:00.000Z',
    ocrMs: 100,
    frame: { imageWidth: 1000, imageHeight: 1000, coordinatesTransposed: false },
    lines: lines.map((text, i) => ({
      text,
      box: { x: 10, y: 100 * (i + 1), width: 400, height: 40 },
    })),
  };
  return {
    schema: 'lmscan.field-trial/3',
    recordedAt: '2026-09-10T00:00:00.000Z',
    seq: 1,
    packet: 'synthetic',
    imageFile: 'synthetic.jpg',
    source: 'still',
    recordedProvider: provider,
    readings: [reading],
    timings: { captureMs: 10, extractMs: 1, evaluateMs: 0 },
    extracted: [],
    verdict: {
      status: 'ATTENTION',
      insufficientReason: null,
      packId: 'x',
      packVersion: '0',
      findings: [],
    },
    ...(want ? { expect: want } : {}),
  };
}

describe('A-0 scorer — the derived numbers', () => {
  it('counts everything asserted, right or wrong, as emitted', () => {
    const t = tally({
      valuesCorrect: 2,
      valuesWrong: 1,
      falseValues: 1,
      findingsCorrect: 3,
      falseFindings: 2,
      valuesMissed: 5,
      withheld: 4,
    });
    // A miss and a withheld value are not outputs, so neither joins the denominator.
    expect(emitted(t)).toBe(9);
    expect(correctOf(t)).toBe(5);
    expect(wrongOf(t)).toBe(4);
  });

  it('counts what the reviewers said was there, ignoring what was withheld', () => {
    expect(expectedOf(tally({ valuesExpected: 6, findingsExpected: 3, withheld: 4 }))).toBe(9);
  });

  it('adds tallies field by field and keeps status agreement conjunctive', () => {
    const a = tally({ valuesCorrect: 1, statusMatches: true });
    const b = tally({ valuesCorrect: 2, falseFindings: 1, statusMatches: false });
    const sum = addTallies(a, b);
    expect(sum.valuesCorrect).toBe(3);
    expect(sum.falseFindings).toBe(1);
    // One disagreement is enough: a run that got the verdict wrong on any packet did not
    // get the verdict right (P3).
    expect(sum.statusMatches).toBe(false);
  });
});

describe('A-0 scorer — replay over records', () => {
  const want: TrialExpectation = {
    fields: { net_quantity: '84.9g', commodity_name: null },
    status: 'ATTENTION',
    findings: [],
  };

  it('reports a provider with no reading as not measured, never as zero', () => {
    const corpus = [
      { file: '001.json', record: record(REFERENCE_PROVIDER_ID, ['NET QTY: 84.9g'], want) },
    ];
    const [candidate] = scoreCorpus(DEMO_PACK, corpus, ['some-other-engine']);

    // The distinction A-0 asks for in as many words: an engine that has not read a packet
    // scored 0% would be indistinguishable from one that read it and got everything wrong.
    expect(candidate.measured).toBe(0);
    expect(candidate.notMeasured).toBe(1);
    expect(candidate.precision).toBeNull();
    expect(candidate.recall).toBeNull();
    expect(candidate.outcomes[0].reason).toBe('no reading');
  });

  it('reports an unreviewed packet as not measured rather than failing it', () => {
    const corpus = [
      { file: '001.json', record: record(REFERENCE_PROVIDER_ID, ['NET QTY: 84.9g'], undefined) },
    ];
    const [score] = scoreCorpus(DEMO_PACK, corpus, [REFERENCE_PROVIDER_ID]);

    // `corpus.test.ts` is what reds the suite for a missing `expect` block. The scorer's
    // job is only to refuse to put a number on it.
    expect(score.measured).toBe(0);
    expect(score.outcomes[0].reason).toBe('no expect block');
    expect(score.precision).toBeNull();
  });

  it('names a provider that is not in PROVIDERS rather than hiding it', () => {
    const corpus = [{ file: '001.json', record: record('ghost', ['NET QTY: 84.9g'], want) }];
    const [score] = scoreCorpus(DEMO_PACK, corpus, ['ghost']);
    expect(score.label).toContain('not in PROVIDERS');
  });

  it('scores a value the reviewer said should not be there as wrong, not as missing', () => {
    // The `commodity_name: "may differ."` failure in docs/PROGRESS.md, as a number: a
    // confident wrong answer must land in the column precision divides by (P3).
    //
    // The vehicle changed on 2026-09-10 and the reason is worth keeping. This test used
    // to feed `actual product may differ.`, relying on the bare anchor `product` being
    // believed mid-sentence. `anchor_must_be_labelled` removed that whole class of false
    // value, so the line now extracts nothing and there was no wrong answer left to
    // score. The subject here is the SCORER, not the extractor, so the line was replaced
    // with a properly labelled anchor whose value the reviewer says should not be there.
    const corpus = [
      {
        file: '001.json',
        record: record(REFERENCE_PROVIDER_ID, ['NET QTY: 84.9g', 'Product Name: Rice Meal'], want),
      },
    ];
    const [score] = scoreCorpus(DEMO_PACK, corpus, [REFERENCE_PROVIDER_ID]);

    expect(score.measured).toBe(1);
    expect(score.totals.valuesCorrect).toBe(1);
    expect(score.totals.falseValues).toBe(1);
    expect(score.totals.withheld).toBe(0);
    expect(wrongOf(score.totals)).toBeGreaterThanOrEqual(1);
    // Precision is dragged down by the false value; it is not a free miss.
    expect(score.precision).not.toBeNull();
    expect(score.precision!).toBeLessThan(1);
  });

  it('counts a correctly withheld value as withheld, and not as a hit', () => {
    const corpus = [
      { file: '001.json', record: record(REFERENCE_PROVIDER_ID, ['NET QTY: 84.9g'], want) },
    ];
    const [score] = scoreCorpus(DEMO_PACK, corpus, [REFERENCE_PROVIDER_ID]);

    expect(score.totals.withheld).toBe(1);
    expect(score.totals.falseValues).toBe(0);
    // Silence is not an output. An engine that reads nothing must not score well here.
    expect(correctOf(score.totals)).toBe(score.totals.valuesCorrect + score.totals.findingsCorrect);
    expect(expectedOf(score.totals)).toBe(1);
  });
});

describe('A-0 report', () => {
  const want: TrialExpectation = {
    fields: { net_quantity: '84.9g' },
    status: 'ATTENTION',
    findings: [],
  };
  const corpus = [
    { file: '001.json', record: record(REFERENCE_PROVIDER_ID, ['NET QTY: 84.9g'], want) },
  ];
  const scores = scoreCorpus(DEMO_PACK, corpus, [REFERENCE_PROVIDER_ID, 'unread-engine']);
  const report = formatReport(scores, corpus);

  it('says in words that precision decides', () => {
    expect(report).toContain('Precision decides');
  });

  it('keeps an unmeasured engine in the table instead of dropping it', () => {
    expect(report).toContain('unread-engine');
    expect(report).toContain('not measured');
  });

  it('marks the engine the expect blocks were written against', () => {
    expect(report).toContain('[reference]');
  });

  it('refuses to let the reference row be read as an accuracy score', () => {
    // The row reads 100% while the suite is green, because the expect blocks drive both
    // it and the assertions. Saying so in the report is the difference between a measured
    // number and a flattering one (P8) — this is the caveat most likely to be dropped by
    // someone tidying the output, so it is pinned.
    expect(report).toContain('regression indicator');
    expect(report).toContain('cannot fall below 100%');
  });

  it('states that a string comparison can score a candidate wrong unfairly', () => {
    // P4/P8: the table's biggest limitation travels with the table, not in a doc nobody
    // opens next to it.
    expect(report).toContain('different spacing');
  });
});
