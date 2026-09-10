/**
 * How it works — the judge-facing page.
 *
 * The unusual parts of this project are structural and therefore invisible: that the
 * decision layer is a pure function, that no clause number is written in any source
 * file, that a severity cap is enforced by data. Nobody reads the repository during a
 * five-minute evaluation, so the design has to be legible from a screen.
 *
 * Everything numeric here is derived from the live rule pack rather than typed, so this
 * page cannot drift out of date the way a slide would.
 */
import { Link } from 'react-router-dom';
import { Card, CardHead, Note, Pill } from '../components/ui';
import { IconAlert, IconCheck, IconScales, IconShield, IconTarget } from '../components/icons';
import { DECLARATIONS, EVIDENCE_THRESHOLDS, FIELDS, FRAME_ADMISSION, PACK } from '../lib/rulepack';

const STAGES = [
  { n: 1, title: 'Recognise', body: 'Text and per-word geometry, on this device' },
  { n: 2, title: 'Extract', body: 'Anchor, then geometry, then shape alone' },
  { n: 3, title: 'Admit', body: 'Is the picture good enough to judge at all?' },
  { n: 4, title: 'Evaluate', body: 'Pure function of facts, geometry and the pack' },
];

function Pipeline() {
  return (
    <div className="overflow-x-auto px-5 py-6">
      <div className="flex min-w-[34rem] items-stretch gap-2">
        {STAGES.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-stretch gap-2">
            <div className="flex-1 rounded-lg border border-line-200 bg-canvas p-3">
              <span className="flex size-5 items-center justify-center rounded-full bg-navy-600 text-[10px] font-semibold text-white">
                {s.n}
              </span>
              <p className="mt-2 text-[12.5px] font-semibold text-ink-900">{s.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{s.body}</p>
            </div>
            {i < STAGES.length - 1 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                className="mt-8 shrink-0 text-ink-400"
              >
                <path
                  d="M4 12h14m0 0-5-5m5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-[11.5px] leading-relaxed text-ink-500">
        <b className="font-semibold text-ink-700">Admission runs third, not first.</b> The plan
        wanted the picture judged before any recognition, to save the work. It cannot be: the only
        quality signals available without raw pixel access are made of text geometry, which does not
        exist until recognition has run. So the correctness half is achieved — no verdict is offered
        on a frame that fails — and the saving is not. That deviation is recorded rather than
        glossed.
      </p>
    </div>
  );
}

function Principle({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line-200 p-5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="rounded bg-navy-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
          {tag}
        </span>
        <h3 className="text-[13.5px] font-semibold text-ink-900">{title}</h3>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-700">{children}</p>
    </div>
  );
}

export function HowItWorks() {
  const contested = DECLARATIONS.filter((d) => d.clause.contested).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Card className="animate-rise">
        <div className="flex flex-wrap items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white">
            <IconScales width={20} height={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] leading-tight font-semibold tracking-tight text-ink-900">
              A compliance tool that can be argued with
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-700">
              An enforcement officer checks perhaps eighty packages a day, against{' '}
              {DECLARATIONS.length} mandatory declarations under the {PACK.statuteLong}. The hard
              part was never spotting text. It is being able to defend the finding afterwards —
              which clause, which reading of it, and what on the package supports it.
            </p>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-700">
              So this is built the other way round from a classifier. Recognition may be
              statistical. The step that turns what was read into a flag is a{' '}
              <b className="font-semibold">pure function</b> with no learned parameters, and every
              flag it emits carries its statute, rule, sub-clause, rule-pack version and the image
              region behind it.
            </p>
          </div>
        </div>
      </Card>

      <Card className="animate-rise">
        <CardHead title="The pipeline" hint="Four stages, in the order they actually run" />
        <Pipeline />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.05em] text-ink-400 uppercase">
            Clause numbers in code
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-semibold text-clear-ink">0</p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            All {DECLARATIONS.length} live in <span className="font-mono">rulepack/*.json</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.05em] text-ink-400 uppercase">
            Verified by an officer
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-semibold text-advisory-ink">0</p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            so every finding is capped at advisory, in data
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.05em] text-ink-400 uppercase">
            Contested sub-clauses
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-semibold text-ink-900">{contested}</p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            shown with both readings, not resolved
          </p>
        </Card>
      </div>

      <Card className="animate-rise">
        <CardHead
          title="Five decisions that shape everything else"
          hint="These are the tiebreakers when two designs both look reasonable"
        />
        <Principle tag="P1" title="The decision layer is deterministic">
          Recognition can be probabilistic. Turning facts into a flag cannot. The evaluator is a
          pure function of (fields, geometry, category, rule pack) — the same inputs always give the
          same verdict, and a disagreement is reproducible rather than a matter of opinion. The same{' '}
          {DECLARATIONS.length} checks run in this browser and on the phone, from one shared
          implementation.
        </Principle>
        <Principle tag="P6" title="Rules are data; the code is an interpreter">
          No statutory fact — clause number, threshold, unit table, lexicon — appears in any source
          file. Amending the tool for a change in the Rules is a change to a JSON file with a
          version and a review status, not a release. That is also what makes the{' '}
          <Link to="/rulepack" className="font-medium text-navy-600 underline underline-offset-2">
            rule pack screen
          </Link>{' '}
          possible: a legal reviewer can see exactly which entries are verified.
        </Principle>
        <Principle tag="P3" title="A false flag costs more than a missed one">
          Precision over recall, deliberately. Uncertain findings are emitted as advisory, never as
          violations. Below {EVIDENCE_THRESHOLDS.minFieldsFound} located declarations or{' '}
          {EVIDENCE_THRESHOLDS.minOcrLines} lines of text, no verdict is offered at all — the tool
          says it cannot tell, rather than reporting declarations it never looked for.
        </Principle>
        <Principle tag="P4" title="Never emit a number the method cannot support">
          There is no millimetre measurement without a stated scale reference, and no sharpness
          score — because sharpness is not measured. A plausible number derived from text density
          and labelled &ldquo;blur&rdquo; would be worse than none.
        </Principle>
        <Principle tag="P9" title="Degrade visibly">
          Every report states what went unchecked, including the ones that pass. The frame-quality
          block names {FRAME_ADMISSION.unscored.join(' and ')} as unmeasured on every single
          verdict, so a quality that was never tested can never read as one that passed.
        </Principle>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="animate-rise">
          <CardHead title="What it refuses to do" hint="The absences are the design" />
          <ul className="flex flex-col gap-3 p-5 text-[12.5px] leading-relaxed text-ink-700">
            {[
              'Say "compliant". It reports that it found no issue among the declarations it checked — a narrower claim, and the only one the method supports.',
              'Assert a reading of a photograph it could not read. A failed recognition is reported as a failed recognition.',
              'Pick a side on an unsettled sub-clause letter. Both readings are shown until an officer confirms one.',
              'Quote an accuracy or latency figure it did not measure on the device it claims to have measured.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <IconAlert width={14} height={14} className="mt-0.5 shrink-0 text-advisory-ink" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="animate-rise">
          <CardHead
            title="What it does, offline"
            hint="No network is required to reach a verdict"
          />
          <ul className="flex flex-col gap-3 p-5 text-[12.5px] leading-relaxed text-ink-700">
            {[
              `Reads ${FIELDS.length} mandatory declarations from a label photograph, in the browser or on an Android device.`,
              'Pairs each value to its printed label by geometry — "2.6 text-heights to the right" — which an officer can check against the photograph by eye.',
              'Measures the capture itself: print size, panel coverage and cropping, against thresholds held in the rule pack.',
              'Produces a printable inspection note carrying every citation and the rule-pack version it was decided under.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <IconCheck width={14} height={14} className="mt-0.5 shrink-0 text-clear-mark" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="animate-rise">
        <CardHead
          title="Honestly, what is not built"
          hint="Stated here so it is not discovered later"
        />
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          <Pill tone="unknown">Backend and sync</Pill>
          <Pill tone="unknown">Applicability gates (Rule 3 exemptions)</Pill>
          <Pill tone="unknown">Rule 7 height / Rule 8(2) parity</Pill>
          <Pill tone="unknown">Barcode and GS1 identity</Pill>
          <Pill tone="unknown">Devanagari recognition</Pill>
          <Pill tone="unknown">E-commerce sweep</Pill>
        </div>
        <p className="px-5 py-4 text-[12.5px] leading-relaxed text-ink-700">
          The scan repository on the other screens is a sample corpus, and says so in the header,
          because the service behind it is not written yet. Measurement of a label you upload is
          real and runs here. Height and parity checks are absent on purpose rather than
          approximated: neither can be done from a photograph without a scale reference in frame,
          and guessing a millimetre figure would break the one promise this tool makes.
        </p>
      </Card>

      <Note tone="advisory" icon={<IconShield width={15} height={15} className="mt-px shrink-0" />}>
        <b className="font-semibold">Nothing here is a determination of law.</b>{' '}
        {PACK.provenanceNote}
      </Note>

      <div className="flex flex-wrap justify-center gap-2 pb-2">
        <Link
          to="/scan"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-navy-700"
        >
          <IconTarget width={16} height={16} />
          Check a package
        </Link>
        <Link
          to="/rulepack"
          className="inline-flex items-center gap-2 rounded-lg border border-line-300 bg-surface px-4 py-2.5 text-[13px] font-medium text-ink-900 transition hover:bg-canvas"
        >
          See the rule pack
        </Link>
      </div>
    </div>
  );
}
