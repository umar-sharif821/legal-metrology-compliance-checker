/**
 * Compliance report — one scan, in full.
 *
 * Three things this screen refuses to do, each of them deliberate:
 *
 *  1. It never says "compliant". It says what was checked and what was found, which is
 *     the only claim the method supports (P3).
 *  2. It never shows a finding without its statute, rule, sub-clause and rule-pack
 *     version — and where the sub-clause letter is itself contested, it says so beside
 *     the citation rather than picking a reading and presenting it as settled.
 *  3. It never shows a verdict without also showing what the capture was *not* checked
 *     for. A passing frame-quality block that quietly omitted blur would be the exact
 *     failure P9 exists to prevent.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardHead,
  ClauseChip,
  Note,
  Pill,
  SeverityBadge,
  Skeleton,
  STATUS_META,
  StatusBadge,
  useToast,
} from '../components/ui';
import {
  IconAlert,
  IconCheck,
  IconChevron,
  IconDownload,
  IconHelp,
  IconScan,
  IconTarget,
} from '../components/icons';
import { LabelPreview } from '../components/LabelPreview';
import { DECLARATIONS, DECLARATIONS_BY_ID, PACK } from '../lib/rulepack';
import { downloadNotice } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useScans } from '../lib/store';
import type { Box, Scan } from '../lib/types';

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] tracking-[0.05em] text-ink-400 uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px] text-ink-900">{value}</dd>
    </div>
  );
}

function FrameQuality({ scan }: { scan: Scan }) {
  return (
    <Card>
      <CardHead
        title="Frame quality"
        hint="Shown on every verdict, not only on a refusal — the numbers behind the decision"
      />
      <ul className="flex flex-col divide-y divide-line-200">
        {scan.admission.checks.map((c) => {
          const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
          const tone = c.passed === null ? 'unknown' : c.passed ? 'clear' : 'violation';
          const Icon = c.passed === null ? IconHelp : c.passed ? IconCheck : IconAlert;
          return (
            <li key={c.id} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <Icon
                  width={14}
                  height={14}
                  strokeWidth={2.2}
                  className={
                    tone === 'clear'
                      ? 'text-clear-mark'
                      : tone === 'violation'
                        ? 'text-violation-mark'
                        : 'text-unknown-mark'
                  }
                />
                <span className="flex-1 text-[12.5px] font-medium text-ink-900">{c.label}</span>
                <span className="tnum font-mono text-[11.5px] text-ink-700">
                  {c.measured === null ? 'not measurable' : pct(c.measured)}
                </span>
                <span className="tnum font-mono text-[11px] text-ink-400">
                  {c.direction === 'min' ? '≥' : '≤'} {pct(c.threshold)}
                </span>
              </div>
              <p className="mt-1 pl-6 text-[11.5px] text-ink-500">{c.question}</p>
            </li>
          );
        })}
      </ul>
      <div className="px-5 pb-5 pt-3">
        <Note
          tone="advisory"
          icon={<IconAlert width={15} height={15} className="mt-px shrink-0" />}
        >
          <b className="font-semibold">Not checked: {scan.admission.unmeasured.join(', ')}.</b>{' '}
          These need raw pixel access this build does not have. This capture can have passed every
          check above and still be unfit to read — which is why the result is stated, not certified.
        </Note>
      </div>
    </Card>
  );
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { getScan, loading } = useScans();
  const navigate = useNavigate();
  const toast = useToast();
  const [focused, setFocused] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const scan = id ? getScan(id) : undefined;

  const highlight = useMemo(() => {
    if (!scan) return [];
    if (focused) {
      const field = scan.fields.find((f) => f.fieldId === focused);
      if (field?.box) {
        const failed = scan.findings.some(
          (f) => DECLARATIONS_BY_ID.get(f.declarationId)?.fieldId === focused,
        );
        return [{ box: field.box, tone: failed ? ('advisory' as const) : ('clear' as const) }];
      }
      return [];
    }
    return scan.fields
      .filter((f): f is typeof f & { box: Box } => f.box !== null)
      .map((f) => ({
        box: f.box,
        tone: scan.findings.some(
          (x) => DECLARATIONS_BY_ID.get(x.declarationId)?.fieldId === f.fieldId,
        )
          ? ('advisory' as const)
          : ('clear' as const),
      }));
  }, [scan, focused]);

  if (loading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <Card className="mx-auto max-w-lg">
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-canvas text-ink-400 ring-1 ring-line-200">
            <IconHelp />
          </div>
          <h2 className="text-sm font-semibold text-ink-900">No such report</h2>
          <p className="mt-1 max-w-sm text-[13px] text-ink-500">
            Report <span className="font-mono">{id}</span> is not in this repository. It may belong
            to a different jurisdiction, or the identifier may be mistyped.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/scans')}>
            Back to the scan explorer
          </Button>
        </div>
      </Card>
    );
  }

  const meta = STATUS_META[scan.status];
  const refused = scan.status === 'INSUFFICIENT_EVIDENCE';

  const checks = DECLARATIONS.map((d) => {
    const finding = scan.findings.find((f) => f.declarationId === d.id);
    return {
      declaration: d,
      state: refused ? ('skipped' as const) : finding ? ('failed' as const) : ('passed' as const),
      finding,
    };
  });

  const onDownload = async () => {
    setDownloading(true);
    const origin = await downloadNotice(scan);
    setDownloading(false);
    toast(
      origin === 'live'
        ? { tone: 'clear', title: 'Notice downloaded', body: `${scan.id}-notice.pdf` }
        : {
            tone: 'unknown',
            title: 'Notice opened for printing',
            body: 'No backend answered, so the notice was composed here. Use your browser’s Save as PDF.',
          },
    );
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* Header */}
      <Card className="animate-rise">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-ink-500">{scan.id}</span>
              <StatusBadge status={scan.status} />
              {scan.sample && (
                <Pill tone="unknown" title="This record came from the bundled sample corpus.">
                  sample record
                </Pill>
              )}
            </div>
            <h2 className="mt-2 text-[19px] leading-tight font-semibold tracking-tight text-ink-900">
              {scan.brand} — {scan.commodity}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-500">
              {meta.blurb}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/scans')}>
              All scans
            </Button>
            <Button size="sm" onClick={() => void onDownload()} disabled={downloading}>
              <IconDownload width={15} height={15} />
              {downloading ? 'Preparing…' : 'Download notice'}
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-line-200 px-5 py-3.5 sm:grid-cols-3 lg:grid-cols-6">
          <Meta label="Captured" value={formatDateTime(scan.capturedAt)} />
          <Meta label="Officer" value={scan.officer} />
          <Meta label="District" value={scan.district} />
          <Meta label="Category" value={scan.category} />
          <Meta
            label="Source"
            value={scan.source === 'device' ? 'Field device' : 'Uploaded image'}
          />
          <Meta label="Rule pack" value={`${scan.packId} v${scan.packVersion}`} />
        </dl>
      </Card>

      {refused && (
        <Note
          tone="unknown"
          icon={<IconHelp width={16} height={16} className="mt-px shrink-0" />}
          className="animate-rise"
        >
          <b className="font-semibold">No verdict was formed for this capture.</b>{' '}
          {scan.insufficientReason}
          {scan.admission.hints.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {scan.admission.hints.map((h) => (
                <li key={h} className="flex items-start gap-1.5">
                  <IconTarget width={13} height={13} className="mt-0.5 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </Note>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        {/* Evidence */}
        <div className="flex flex-col gap-4">
          <Card className="animate-rise">
            <CardHead
              title="Evidence"
              hint={
                scan.imageUrl
                  ? 'The capture, with each located declaration outlined'
                  : 'Drawn from the sample record — not a photograph'
              }
              action={
                focused ? (
                  <button
                    onClick={() => setFocused(null)}
                    className="rounded px-2 py-1 text-[11.5px] font-medium text-navy-600 hover:bg-canvas"
                  >
                    Show all
                  </button>
                ) : undefined
              }
            />
            <div className="p-5">
              <LabelPreview scan={scan} highlight={highlight} />
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500">
                Every finding points at a region a person can look at and disagree with. Select a
                declaration on the right to isolate its region.
              </p>
            </div>
          </Card>

          <FrameQuality scan={scan} />

          <Card>
            <CardHead title="Stage timings" hint="Indicative for this build — not a benchmark" />
            <ul className="flex flex-col divide-y divide-line-200">
              {[
                ['Text recognition', scan.timings.ocrMs],
                ['Extraction', scan.timings.extractMs],
                ['Rule evaluation', scan.timings.evaluateMs],
              ].map(([label, ms]) => (
                <li key={label as string} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-[12.5px] text-ink-700">{label}</span>
                  <span className="tnum font-mono text-[12px] text-ink-900">{ms} ms</span>
                </li>
              ))}
            </ul>
            <p className="px-5 py-3 text-[11px] leading-relaxed text-ink-400">
              Latency claims for this project come from recorded per-stage timings on the benchmark
              device. These are not those numbers and must not be quoted as them.
            </p>
          </Card>
        </div>

        {/* Declarations + findings */}
        <div className="flex flex-col gap-4">
          <Card className="animate-rise">
            <CardHead
              title="Declarations read from the label"
              hint={`${scan.fields.filter((f) => f.found).length} of ${scan.fields.length} located`}
            />
            <ul className="flex flex-col divide-y divide-line-200">
              {scan.fields.map((f) => {
                const failed = scan.findings.some(
                  (x) => DECLARATIONS_BY_ID.get(x.declarationId)?.fieldId === f.fieldId,
                );
                const active = focused === f.fieldId;
                return (
                  <li key={f.fieldId}>
                    <button
                      onClick={() => setFocused(active ? null : f.fieldId)}
                      className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors ${
                        active ? 'bg-navy-600/5' : 'hover:bg-canvas'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full ${
                          !f.found
                            ? 'bg-advisory-bg text-advisory-ink ring-1 ring-advisory-line'
                            : failed
                              ? 'bg-advisory-bg text-advisory-ink ring-1 ring-advisory-line'
                              : 'bg-clear-bg text-clear-ink ring-1 ring-clear-line'
                        }`}
                      >
                        {f.found && !failed ? (
                          <IconCheck width={11} height={11} strokeWidth={3} />
                        ) : (
                          <IconAlert width={10} height={10} strokeWidth={2.6} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] text-ink-500">{f.label}</span>
                        <span
                          className={`mt-0.5 block text-[13px] font-medium ${
                            f.found ? 'text-ink-900' : 'text-advisory-ink italic'
                          }`}
                        >
                          {f.found
                            ? f.value
                            : refused
                              ? 'not evaluated'
                              : 'not found on this panel'}
                        </span>
                        {f.association && (
                          <span className="mt-1 block text-[11px] leading-snug text-ink-400">
                            {f.association}
                          </span>
                        )}
                      </span>

                      {f.confidence && (
                        <Pill
                          tone={
                            f.confidence === 'high'
                              ? 'clear'
                              : f.confidence === 'medium'
                                ? 'advisory'
                                : 'unknown'
                          }
                          title="Extraction confidence — a property of the reading, not of the law."
                        >
                          {f.confidence}
                        </Pill>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="animate-rise">
            <CardHead
              title={`Rule checks (${checks.filter((c) => c.state === 'failed').length} of ${checks.length} flagged)`}
              hint="Every check the pack defines, and how this package answered it"
            />
            <ul className="flex flex-col divide-y divide-line-200">
              {checks.map(({ declaration: d, state, finding }) => (
                <li
                  key={d.id}
                  className={`px-5 py-3.5 ${state === 'failed' ? 'bg-advisory-bg/35' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ClauseChip
                      cite={d.clause.cite}
                      contested={d.clause.contested}
                      title={d.clause.note}
                    />
                    {state === 'failed' && finding && <SeverityBadge severity={finding.severity} />}
                    {state === 'passed' && (
                      <Pill tone="clear">
                        <IconCheck width={11} height={11} strokeWidth={2.6} /> present
                      </Pill>
                    )}
                    {state === 'skipped' && <Pill tone="unknown">not evaluated</Pill>}
                    <span className="ml-auto font-mono text-[10.5px] text-ink-400">{d.id}</span>
                  </div>

                  {/* The pack's `title` states the FAILURE ("... not found"). Printing it
                      beside a green "present" pill reads as a contradiction, so a passing
                      check is headed by the declaration itself. */}
                  <p className="mt-2 text-[13px] font-medium text-ink-900">
                    {state === 'failed' ? d.title : d.fieldLabel}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{d.requirement}</p>

                  {finding?.evidenceText && (
                    <p className="mt-2 rounded border border-advisory-line bg-advisory-bg px-2.5 py-1.5 font-mono text-[11.5px] text-advisory-ink">
                      Observed: {finding.evidenceText}
                    </p>
                  )}

                  {state === 'failed' && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-700">
                      <IconTarget width={13} height={13} className="mt-0.5 shrink-0 text-ink-400" />
                      {d.remedy}
                    </p>
                  )}

                  {d.clause.contested && (
                    <p className="mt-2 text-[11px] leading-relaxed text-advisory-ink">
                      <b className="font-semibold">Sub-clause letter unverified.</b> Also read as{' '}
                      {d.clause.alternates.map((a) => a.sub_clause).join(' or ')} —{' '}
                      {d.clause.alternates[0]?.note}
                    </p>
                  )}

                  {state === 'failed' && (
                    <button
                      onClick={() => setFocused(d.fieldId)}
                      className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-navy-600 hover:underline"
                    >
                      Show the region on the label
                      <IconChevron width={12} height={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Note tone="advisory">
            <b className="font-semibold">This report is not a determination of law.</b>{' '}
            {PACK.provenanceNote}{' '}
            <Link to="/rulepack" className="font-medium underline underline-offset-2">
              Review status per clause
            </Link>
            .
          </Note>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 rounded-lg border border-line-300 bg-surface px-4 py-2 text-[13px] font-medium text-ink-900 transition hover:bg-canvas"
            >
              <IconScan width={15} height={15} />
              Check another package
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
