/**
 * Overview.
 *
 * Plan §12: "Every tile is a link into a pre-filtered scan list — a dashboard number
 * that cannot be drilled into is decoration." Every figure here is both computed from
 * the same scan list the explorer renders (so they cannot disagree) and clickable
 * through to the rows behind it.
 */
import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarList, Sparkline, TrendChart, type TrendPoint } from '../components/charts';
import { Card, CardHead, ClauseChip, Note, Skeleton, useCountUp } from '../components/ui';
import { IconAlert, IconCheck, IconChevron, IconHelp, IconScan } from '../components/icons';
import { computeStats } from '../lib/stats';
import { formatCount, formatPercent } from '../lib/format';
import { useScans } from '../lib/store';
import { PACK } from '../lib/rulepack';

function StatTile({
  label,
  value,
  display,
  spark,
  tone,
  to,
  foot,
}: {
  label: string;
  value: number;
  display: (n: number) => string;
  spark: readonly number[];
  tone: 'clear' | 'advisory' | 'unknown';
  to: string;
  foot: ReactNode;
}) {
  const animated = useCountUp(value);
  const Icon = tone === 'clear' ? IconCheck : tone === 'advisory' ? IconAlert : IconHelp;
  const ink = {
    clear: 'text-clear-ink',
    advisory: 'text-advisory-ink',
    unknown: 'text-unknown-ink',
  }[tone];

  return (
    <Link
      to={to}
      className="card group flex flex-col gap-2 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-center gap-1.5">
        <Icon width={13} height={13} className={ink} strokeWidth={2.2} />
        <span className="text-[11.5px] font-medium text-ink-500">{label}</span>
        <IconChevron
          width={13}
          height={13}
          className="ml-auto text-ink-400 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      <p className="text-[26px] leading-none font-semibold tracking-tight text-ink-900">
        {display(animated)}
      </p>
      <Sparkline values={spark} tone={tone} />
      <p className="text-[11px] leading-snug text-ink-400">{foot}</p>
    </Link>
  );
}

export function Overview() {
  const { scans, loading } = useScans();
  const navigate = useNavigate();
  const stats = useMemo(() => computeStats(scans), [scans]);

  const trend: TrendPoint[] = stats.byDay.map((d) => ({
    label: new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    value: d.clearRate7,
    detail:
      d.scans === 0 ? null : (
        <>
          {d.scans} scan{d.scans === 1 ? '' : 's'} · {d.clear} clear · {d.attention} attention
          {d.insufficient > 0 && ` · ${d.insufficient} refused`}
        </>
      ),
  }));

  const heroRate = stats.clearRate;
  const heroAnimated = useCountUp(heroRate ?? 0, 900);

  if (loading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const last14 = stats.byDay.slice(-14);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* Hero — exactly one per view */}
      <Card className="animate-rise overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-center">
          <div>
            <p className="text-[11.5px] font-medium tracking-[0.05em] text-ink-500 uppercase">
              No issues found, of conclusive scans
            </p>
            <p className="mt-2 text-[52px] leading-none font-semibold tracking-tight text-ink-900">
              {heroRate === null ? '—' : formatPercent(heroAnimated)}
            </p>
            <p className="mt-2.5 max-w-md text-[12.5px] leading-relaxed text-ink-500">
              {formatCount(stats.clear)} of {formatCount(stats.conclusive)} conclusive scans carried
              no finding. The {formatCount(stats.insufficient)} refused captures are excluded — a
              refusal is not a pass and not a failure, so counting it as either would be wrong.
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[11.5px] font-medium text-ink-500">
              Last 30 days · 7-day trailing average
            </p>
            <TrendChart points={trend} height={168} />
          </div>
        </div>
      </Card>

      {/* Stat tiles — each drills into the rows behind it */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Scans"
          value={stats.total}
          display={(n) => formatCount(Math.round(n))}
          spark={last14.map((d) => d.scans)}
          tone="unknown"
          to="/scans"
          foot="Across all officers and districts"
        />
        <StatTile
          label="Needs attention"
          value={stats.attention}
          display={(n) => formatCount(Math.round(n))}
          spark={last14.map((d) => d.attention)}
          tone="advisory"
          to="/scans?status=ATTENTION"
          foot={`${formatCount(stats.findings)} advisory findings in total`}
        />
        <StatTile
          label="No issues found"
          value={stats.clear}
          display={(n) => formatCount(Math.round(n))}
          spark={last14.map((d) => d.clear)}
          tone="clear"
          to="/scans?status=NO_ISSUES_FOUND"
          foot="Only the checked declarations were checked"
        />
        <StatTile
          label="Captures refused"
          value={stats.insufficient}
          display={(n) => formatCount(Math.round(n))}
          spark={last14.map((d) => d.insufficient)}
          tone="unknown"
          to="/scans?status=INSUFFICIENT_EVIDENCE"
          foot={`${formatPercent(stats.refusalRate, 0)} of captures — refused before a verdict was formed`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="animate-rise">
          <CardHead
            title="Most frequently flagged declarations"
            hint="Which single declaration is most often missing — a question no one officer can answer alone"
          />
          {stats.topRules.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-500">No findings recorded.</p>
          ) : (
            <BarList
              rows={stats.topRules.slice(0, 6).map((r) => ({
                key: r.declarationId,
                label: r.title,
                sub: (
                  <span className="inline-flex items-center gap-1.5">
                    <ClauseChip
                      cite={r.cite}
                      contested={r.contested}
                      title={
                        r.contested
                          ? 'The sub-clause letter itself is unverified — see the Rule pack screen.'
                          : undefined
                      }
                    />
                  </span>
                ),
                value: r.count,
                onClick: () => navigate(`/scans?rule=${encodeURIComponent(r.declarationId)}`),
              }))}
            />
          )}
        </Card>

        <Card className="animate-rise">
          <CardHead
            title="Declaration presence"
            hint="How often each declaration was actually found, across conclusive scans"
          />
          <BarList
            rows={stats.declarationCoverage.map((c) => ({
              key: c.fieldId,
              label: c.label,
              value: Math.round((c.found / Math.max(1, c.of)) * 100),
            }))}
            max={100}
            format={(v) => `${v}%`}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="animate-rise">
          <CardHead title="By category" hint="Scans needing attention, per commodity category" />
          <BarList
            rows={stats.byCategory.slice(0, 7).map((t) => ({
              key: t.key,
              label: t.key,
              sub: `${t.count} of ${t.total} scans`,
              value: t.count,
              onClick: () => navigate(`/scans?q=${encodeURIComponent(t.key)}`),
            }))}
          />
        </Card>

        <Card className="animate-rise">
          <CardHead title="By district" hint="Scans needing attention, per jurisdiction" />
          <BarList
            rows={stats.byDistrict.map((t) => ({
              key: t.key,
              label: t.key,
              sub: `${t.count} of ${t.total} scans`,
              value: t.count,
              onClick: () => navigate(`/scans?q=${encodeURIComponent(t.key)}`),
            }))}
          />
        </Card>
      </div>

      <Note tone="unknown" className="animate-rise">
        <b className="font-semibold">What these numbers are.</b> {PACK.scopeNote} Nothing on this
        screen is an accuracy or latency measurement — accuracy figures come from the evaluation
        harness and latency from recorded per-stage timings on the benchmark device, neither of
        which is wired into this dashboard yet.{' '}
        <Link to="/rulepack" className="font-medium underline underline-offset-2">
          See the rule pack and its review status
        </Link>
        .
      </Note>

      <div className="flex justify-center pb-2">
        <Link
          to="/scan"
          className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-navy-700"
        >
          <IconScan width={16} height={16} />
          Check a new package
        </Link>
      </div>
    </div>
  );
}
