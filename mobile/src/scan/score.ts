/**
 * Per-provider accuracy scoring over the field-trial corpus — phase `A-0`.
 *
 * `docs/DEMO_PLAN.md` §4 A-0: *"`corpus.test.ts` reports per provider: declarations
 * located, values correct against the reviewer's `expect` block, and false findings.
 * **Precision first** (P3) — a false flag is counted more heavily than a miss, and the
 * report says so."* This module is that arithmetic, kept out of the test file so it can
 * be tested on inputs it was not written against (`score.test.ts`).
 *
 * **What "counted more heavily" means here, exactly.** There is no weighting constant —
 * inventing one would be a number the method cannot support (P4). Precision is instead
 * made *the* headline: it is the first column, the table is ordered by it, and the report
 * says in words that it decides. A miss costs recall, which is reported beside it and does
 * not decide. That is P3 expressed as what the report ranks by, rather than as a fudge
 * factor nobody can defend.
 *
 * **Correctly withholding a value is not scored as a hit.** A reviewer's `null` says the
 * packet contains nothing that legitimately fills the field, so extracting something there
 * is a false positive — but *not* extracting it is the absence of an output, not an
 * output. Counting silence as a success would let an engine that reads nothing at all
 * score perfectly. It is reported separately, as `withheld`.
 *
 * Pure and Node-loadable: no `expo-*`, no `node:fs`. The test file does the reading.
 */
import type { CompiledPack } from '../rulepack/pack';
import { evaluate } from '../verdict/evaluate';
import { extract } from './extract';
import { describeProvider, REFERENCE_PROVIDER_ID } from './provider';
import type { FieldTrialRecord, TrialReading } from './recordTypes';
import type { OcrFrame } from './types';

/** What one engine made of one packet, against what the reviewer said it should make. */
export interface PacketTally {
  /** Non-null `expect.fields` entries — the declarations a reviewer says are on the label. */
  readonly valuesExpected: number;
  readonly valuesCorrect: number;
  /** Extracted, but not the string the reviewer wrote. A confident wrong answer (P3). */
  readonly valuesWrong: number;
  /** Expected, and nothing extracted at all. */
  readonly valuesMissed: number;
  /** `expect` said this field is not on the label, and a value appeared anyway. */
  readonly falseValues: number;
  /** `expect` said not on the label, and nothing appeared. Reported, never scored. */
  readonly withheld: number;
  readonly findingsExpected: number;
  readonly findingsCorrect: number;
  readonly findingsMissed: number;
  /** A flag raised that the reviewer did not expect — the costliest error in the project. */
  readonly falseFindings: number;
  readonly statusMatches: boolean;
}

export type OutcomeReason = 'measured' | 'no reading' | 'no expect block';

export interface PacketOutcome {
  readonly file: string;
  readonly packet: string;
  /**
   * Null when this provider has no reading for this packet, or the packet has no `expect`
   * block yet. Both are *not measured*, and neither is a zero (`DEMO_PLAN` §4 A-0).
   */
  readonly tally: PacketTally | null;
  readonly reason: OutcomeReason;
}

export interface ProviderScore {
  readonly provider: string;
  readonly label: string;
  /** True for the engine the app ships and the one every `expect` block was written for. */
  readonly isReference: boolean;
  readonly outcomes: readonly PacketOutcome[];
  readonly measured: number;
  readonly notMeasured: number;
  readonly totals: PacketTally;
  /** Right ÷ everything emitted. **Null** when nothing was emitted — never a 0 or a 1 (P4). */
  readonly precision: number | null;
  /** Right ÷ everything the reviewers said was there. Null when nothing was expected. */
  readonly recall: number | null;
  readonly statusMatches: number;
}

const ZERO: PacketTally = {
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

/** Everything this engine asserted about the packet: values it printed, flags it raised. */
export function emitted(t: PacketTally): number {
  return t.valuesCorrect + t.valuesWrong + t.falseValues + t.findingsCorrect + t.falseFindings;
}

/** Everything a reviewer said was there to find. */
export function expectedOf(t: PacketTally): number {
  return t.valuesExpected + t.findingsExpected;
}

export function correctOf(t: PacketTally): number {
  return t.valuesCorrect + t.findingsCorrect;
}

/** Everything asserted that was not right — the number P3 makes primary. */
export function wrongOf(t: PacketTally): number {
  return t.valuesWrong + t.falseValues + t.falseFindings;
}

export function addTallies(a: PacketTally, b: PacketTally): PacketTally {
  return {
    valuesExpected: a.valuesExpected + b.valuesExpected,
    valuesCorrect: a.valuesCorrect + b.valuesCorrect,
    valuesWrong: a.valuesWrong + b.valuesWrong,
    valuesMissed: a.valuesMissed + b.valuesMissed,
    falseValues: a.falseValues + b.falseValues,
    withheld: a.withheld + b.withheld,
    findingsExpected: a.findingsExpected + b.findingsExpected,
    findingsCorrect: a.findingsCorrect + b.findingsCorrect,
    findingsMissed: a.findingsMissed + b.findingsMissed,
    falseFindings: a.falseFindings + b.falseFindings,
    statusMatches: a.statusMatches && b.statusMatches,
  };
}

/**
 * Rebuild the `OcrFrame` an engine reported, from what its reading kept.
 *
 * `ocrMs` is carried rather than zeroed. The evaluator does not read it today, but a
 * replayed verdict that quietly claims a zero-millisecond OCR is a latency number nobody
 * measured (P8).
 */
export function readingFrame(reading: TrialReading): OcrFrame {
  return {
    lines: reading.lines,
    imageWidth: reading.frame.imageWidth,
    imageHeight: reading.frame.imageHeight,
    coordinatesTransposed: reading.frame.coordinatesTransposed,
    ocrMs: reading.ocrMs,
  };
}

/**
 * Replay one reading through the same pure path the device runs, and count what it got.
 *
 * `pack` is a parameter rather than an import so the scorer holds no opinion about which
 * rule pack is in force — the same discipline `extract` and `evaluate` already follow.
 * A record with no `expect` block cannot be scored and returns an all-zero tally; callers
 * must not reach here for one, and `scoreCorpus` does not.
 */
export function tallyReading(
  pack: CompiledPack,
  record: FieldTrialRecord,
  reading: TrialReading,
): PacketTally {
  const want = record.expect;
  if (!want) return ZERO;

  const extraction = extract(pack, reading.lines);
  const verdict = evaluate(pack, readingFrame(reading), extraction);
  const actual = new Map(extraction.fields.map((f) => [f.fieldId, f.value]));

  let valuesExpected = 0;
  let valuesCorrect = 0;
  let valuesWrong = 0;
  let valuesMissed = 0;
  let falseValues = 0;
  let withheld = 0;

  for (const [fieldId, wanted] of Object.entries(want.fields)) {
    const got = actual.get(fieldId);
    if (wanted === null) {
      if (got === undefined) withheld += 1;
      else falseValues += 1;
      continue;
    }
    valuesExpected += 1;
    if (got === undefined) valuesMissed += 1;
    else if (got === wanted) valuesCorrect += 1;
    else valuesWrong += 1;
  }

  const wantedFindings = new Set(want.findings);
  const gotFindings = new Set(verdict.findings.map((f) => f.declarationId));
  let findingsCorrect = 0;
  let falseFindings = 0;
  for (const id of gotFindings) {
    if (wantedFindings.has(id)) findingsCorrect += 1;
    else falseFindings += 1;
  }

  return {
    valuesExpected,
    valuesCorrect,
    valuesWrong,
    valuesMissed,
    falseValues,
    withheld,
    findingsExpected: wantedFindings.size,
    findingsCorrect,
    findingsMissed: wantedFindings.size - findingsCorrect,
    falseFindings,
    statusMatches: verdict.status === want.status,
  };
}

export interface CorpusEntry {
  readonly file: string;
  readonly record: FieldTrialRecord;
}

/**
 * Score every engine named in `providers` across the whole corpus.
 *
 * Iterating the provider list rather than the readings is deliberate: an engine that has
 * read nothing still gets a row saying *not measured* on every packet. An engine missing
 * from the table entirely would look like an engine nobody had thought of, which is the
 * opposite of what a comparison table is for.
 */
export function scoreCorpus(
  pack: CompiledPack,
  corpus: readonly CorpusEntry[],
  providers: readonly string[],
): readonly ProviderScore[] {
  return providers.map((provider) => {
    const outcomes: readonly PacketOutcome[] = corpus.map(({ file, record }) => {
      const reading = record.readings.find((r) => r.provider === provider);
      if (!reading)
        return { file, packet: record.packet, tally: null, reason: 'no reading' as const };
      if (!record.expect)
        return { file, packet: record.packet, tally: null, reason: 'no expect block' as const };
      return {
        file,
        packet: record.packet,
        tally: tallyReading(pack, record, reading),
        reason: 'measured' as const,
      };
    });

    const measured = outcomes.flatMap((o) => (o.tally ? [o.tally] : []));
    const totals = measured.reduce(addTallies, ZERO);
    const out = emitted(totals);
    const due = expectedOf(totals);

    return {
      provider,
      label: describeProvider(provider)?.label ?? `${provider} (not in PROVIDERS)`,
      isReference: provider === REFERENCE_PROVIDER_ID,
      outcomes,
      measured: measured.length,
      notMeasured: outcomes.length - measured.length,
      totals,
      precision: out === 0 ? null : correctOf(totals) / out,
      recall: due === 0 ? null : correctOf(totals) / due,
      statusMatches: measured.filter((t) => t.statusMatches).length,
    };
  });
}

function pct(value: number | null): string {
  return value === null ? 'not measured' : `${(value * 100).toFixed(1)}%`;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

/**
 * What the corpus is made of, in `source` terms — the caveat that has to travel with it.
 *
 * `C-0` established that a `viewfinder` frame and an `upload` are not interchangeable
 * measurements of the same label: the same packet gave 32 lines as a preview pass and 111
 * as a full-quality capture. The table below averages over whatever the corpus holds, so
 * a corpus of one kind is a number about that kind and nothing else (P8). Saying so is
 * the cheapest way to stop the headline being quoted as "ML Kit's accuracy".
 */
function sourceMix(corpus: readonly CorpusEntry[]): string {
  const counts = new Map<string, number>();
  for (const { record } of corpus) {
    counts.set(record.source, (counts.get(record.source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, n]) => `${n} ${source}`)
    .join(', ');
}

/**
 * The per-provider table, as text a person reads in the test output.
 *
 * Ordered by precision, highest first, with *not measured* rows last — because P3 says
 * precision is what decides, and a table ordered by anything else quietly argues
 * otherwise. Rows are never dropped: an engine with no readings appears, saying so.
 */
export function formatReport(
  scores: readonly ProviderScore[],
  corpus: readonly CorpusEntry[],
): string {
  const packets = corpus.length;
  const ordered = [...scores].sort((a, b) => (b.precision ?? -1) - (a.precision ?? -1));
  const referenceLabel = describeProvider(REFERENCE_PROVIDER_ID)?.label ?? REFERENCE_PROVIDER_ID;
  const nameOf = (s: ProviderScore) => `${s.label}${s.isReference ? ' [reference]' : ''}`;
  const width = Math.max(20, ...ordered.map((s) => nameOf(s).length));
  const sources = new Set(corpus.map((c) => c.record.source));

  const lines: string[] = [
    '',
    `A-0 · per-provider accuracy over ${packets} recorded packet${packets === 1 ? '' : 's'}`,
    `Capture mix: ${sourceMix(corpus) || 'nothing recorded'}.`,
    ...(sources.size === 1
      ? [
          `Every packet here is a "${[...sources][0]}" capture, so this measures that capture`,
          `kind and not the engine in general. C-0 measured the same packet at 32 lines as a`,
          `viewfinder pass and 111 as a full-quality capture — a comparison the corpus cannot`,
          `yet make, because no packet has been recorded twice from two kinds of image.`,
        ]
      : []),
    'Precision decides (P3): a wrong value or a false flag costs more than a miss.',
    'Recall is reported beside it and does not decide. Correctly withholding a value',
    'is counted as `withheld`, never as a hit.',
    '',
    `${pad('provider', width)}  ${pad('precision', 12)}  ${pad('recall', 12)}  ` +
      `${pad('packets', 15)}  ${pad('right', 5)}  ${pad('wrong', 5)}  ${pad('missed', 6)}  ` +
      `${pad('false flags', 11)}  withheld`,
  ];

  for (const s of ordered) {
    const packetsCell =
      s.notMeasured === 0 ? `${s.measured}` : `${s.measured} (+${s.notMeasured} n/m)`;
    lines.push(
      `${pad(nameOf(s), width)}  ${pad(pct(s.precision), 12)}  ${pad(pct(s.recall), 12)}  ` +
        `${pad(packetsCell, 15)}  ${pad(String(correctOf(s.totals)), 5)}  ` +
        `${pad(String(wrongOf(s.totals)), 5)}  ` +
        `${pad(String(s.totals.valuesMissed + s.totals.findingsMissed), 6)}  ` +
        `${pad(String(s.totals.falseFindings), 11)}  ${s.totals.withheld}`,
    );
  }

  for (const s of ordered.filter((x) => x.measured === 0)) {
    lines.push('');
    lines.push(
      `  ${s.label}: not measured — no reading in any record, and no zero is reported for`,
    );
    lines.push(`  it. To give it a column, replay each packet's image through it and append a`);
    lines.push(
      `  reading. The images are NOT in the repository (see mobile/field-trial/README.md),`,
    );
    lines.push(`  so this can only be done on a machine that still holds them — which is the real`);
    lines.push(`  limit on scoring a new engine against packets already collected.`);
  }

  lines.push('');
  lines.push(`  Read the [reference] row as a regression indicator, not as an accuracy score.`);
  lines.push(`  It cannot fall below 100% while the suite is green: the same expect blocks drive`);
  lines.push(
    `  both the assertions and this table, and they were written while reading ${referenceLabel}'s`,
  );
  lines.push(`  own output. It says the shipped engine still does what it did, which is worth`);
  lines.push(`  knowing and is not the same as being right. It is also silent about declarations`);
  lines.push(`  no reviewer named: a field absent from every expect block is not scored anywhere.`);
  lines.push('');
  lines.push('  Values are compared as exact strings against a block a reviewer wrote while');
  lines.push(
    `  reading ${referenceLabel}'s output. A candidate engine that reads the same declaration`,
  );
  lines.push('  with different spacing scores wrong here. That is a known limit of this');
  lines.push('  comparison, not a finding about the engine — read the cells before acting.');
  lines.push('');
  return lines.join('\n');
}
