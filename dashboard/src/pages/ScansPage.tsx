/**
 * Scan explorer — the workhorse.
 *
 * Filters live in the URL so a filtered view is a link an officer can send to a
 * colleague, and so every tile on the Overview can drill into exactly these rows.
 */
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  ClauseChip,
  EmptyState,
  Pill,
  Skeleton,
  StatusBadge,
  useToast,
} from '../components/ui';
import { IconDownload, IconList, IconScan, IconSearch } from '../components/icons';
import { DECLARATIONS_BY_ID } from '../lib/rulepack';
import { formatDateTime, formatRelative, initials } from '../lib/format';
import { useScans } from '../lib/store';
import type { Scan, ScanStatus } from '../lib/types';

const STATUS_OPTIONS: { value: ScanStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'ATTENTION', label: 'Needs attention' },
  { value: 'NO_ISSUES_FOUND', label: 'No issues found' },
  { value: 'INSUFFICIENT_EVIDENCE', label: 'Capture refused' },
];

const selectClass =
  'h-9 rounded-lg border border-line-300 bg-surface px-2.5 text-[12.5px] text-ink-900 transition-colors hover:border-ink-400 focus:border-navy-600';

function toCsv(rows: readonly Scan[]): string {
  const head = [
    'scan_id',
    'captured_at',
    'status',
    'brand',
    'commodity',
    'category',
    'officer',
    'district',
    'findings',
    'flagged_clauses',
    'rule_pack',
    'sample_record',
  ];
  const body = rows.map((s) =>
    [
      s.id,
      s.capturedAt,
      s.status,
      s.brand,
      s.commodity,
      s.category,
      s.officer,
      s.district,
      String(s.findings.length),
      s.findings
        .map((f) => DECLARATIONS_BY_ID.get(f.declarationId)?.clause.cite ?? f.declarationId)
        .join('; '),
      `${s.packId} v${s.packVersion}`,
      String(s.sample),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export function ScansPage() {
  const { scans, loading } = useScans();
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const q = params.get('q') ?? '';
  const status = (params.get('status') ?? '') as ScanStatus | '';
  const rule = params.get('rule') ?? '';
  const days = params.get('days') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cutoff = days ? Date.now() - Number(days) * 86400000 : null;
    return scans.filter((s) => {
      if (status && s.status !== status) return false;
      if (rule && !s.findings.some((f) => f.declarationId === rule)) return false;
      if (cutoff && Date.parse(s.capturedAt) < cutoff) return false;
      if (!needle) return true;
      return [s.id, s.brand, s.commodity, s.category, s.officer, s.district]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [scans, q, status, rule, days]);

  const ruleMeta = rule ? DECLARATIONS_BY_ID.get(rule) : undefined;
  const active = Boolean(q || status || rule || days);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lm-scans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      tone: 'clear',
      title: 'Export ready',
      body: `${filtered.length} row${filtered.length === 1 ? '' : 's'} written to CSV.`,
    });
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Card className="animate-rise">
        <div className="flex flex-wrap items-center gap-2 p-3.5">
          <div className="relative min-w-[13rem] flex-1">
            <IconSearch
              width={15}
              height={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
            />
            <input
              value={q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search brand, commodity, officer, district or scan id"
              className="h-9 w-full rounded-lg border border-line-300 bg-surface pr-3 pl-9 text-[12.5px] text-ink-900 transition-colors placeholder:text-ink-400 hover:border-ink-400 focus:border-navy-600"
            />
          </div>

          <select value={status} onChange={(e) => set('status', e.target.value)} className={selectClass}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select value={days} onChange={(e) => set('days', e.target.value)} className={selectClass}>
            <option value="">Any date</option>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>

          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <IconDownload width={14} height={14} />
            CSV
          </Button>
        </div>

        {(ruleMeta || active) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line-200 px-4 py-2.5 text-[12px]">
            <span className="text-ink-500">
              {filtered.length} of {scans.length} scans
            </span>
            {ruleMeta && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-ink-400">·</span>
                <ClauseChip cite={ruleMeta.clause.cite} contested={ruleMeta.clause.contested} />
                <span className="text-ink-700">{ruleMeta.title}</span>
              </span>
            )}
            {active && (
              <button
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="ml-auto font-medium text-navy-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="animate-rise">
          <EmptyState
            icon={<IconList />}
            title={scans.length === 0 ? 'No scans recorded yet' : 'Nothing matches those filters'}
            body={
              scans.length === 0
                ? 'Once a package is checked, its report appears here with the clauses it was measured against.'
                : 'Widen the date range, clear the status filter, or search for a different brand.'
            }
            action={
              scans.length === 0 ? (
                <Link
                  to="/scan"
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-navy-700"
                >
                  <IconScan width={15} height={15} />
                  Check a package
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="animate-rise overflow-hidden">
          {/* Desktop table */}
          <table className="hidden w-full md:table">
            <thead>
              <tr className="border-b border-line-200 text-left text-[11px] tracking-[0.04em] text-ink-500 uppercase">
                <th className="px-5 py-2.5 font-medium">Package</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Flagged clauses</th>
                <th className="px-3 py-2.5 font-medium">Officer</th>
                <th className="px-3 py-2.5 font-medium">Captured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-200">
              {filtered.slice(0, 120).map((s) => (
                <tr key={s.id} className="group transition-colors hover:bg-canvas">
                  <td className="px-5 py-3">
                    <Link to={`/scans/${s.id}`} className="block">
                      <span className="block text-[13px] font-medium text-ink-900 group-hover:text-navy-600">
                        {s.brand} — {s.commodity}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-ink-500">
                        <span className="font-mono">{s.id}</span> · {s.category} · {s.district}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={s.status} size="sm" />
                  </td>
                  <td className="px-3 py-3">
                    {s.findings.length === 0 ? (
                      <span className="text-[12px] text-ink-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.findings.slice(0, 3).map((f) => {
                          const d = DECLARATIONS_BY_ID.get(f.declarationId);
                          return (
                            <ClauseChip
                              key={f.declarationId}
                              cite={d?.clause.cite ?? f.declarationId}
                              contested={d?.clause.contested}
                              title={d?.title}
                            />
                          );
                        })}
                        {s.findings.length > 3 && (
                          <span className="self-center text-[11px] text-ink-500">
                            +{s.findings.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-canvas text-[10px] font-semibold text-ink-700 ring-1 ring-line-200">
                        {initials(s.officer)}
                      </span>
                      <span className="text-[12.5px] text-ink-700">{s.officer}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12.5px] text-ink-700" title={formatDateTime(s.capturedAt)}>
                      {formatRelative(s.capturedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="divide-y divide-line-200 md:hidden">
            {filtered.slice(0, 120).map((s) => (
              <li key={s.id}>
                <Link to={`/scans/${s.id}`} className="block px-4 py-3.5 transition-colors hover:bg-canvas">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink-900">
                        {s.brand} — {s.commodity}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-500">
                        <span className="font-mono">{s.id}</span> · {s.district}
                      </p>
                    </div>
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {s.findings.slice(0, 2).map((f) => {
                      const d = DECLARATIONS_BY_ID.get(f.declarationId);
                      return (
                        <ClauseChip
                          key={f.declarationId}
                          cite={d?.clause.cite ?? f.declarationId}
                          contested={d?.clause.contested}
                        />
                      );
                    })}
                    {s.findings.length > 2 && (
                      <Pill tone="unknown">+{s.findings.length - 2} more</Pill>
                    )}
                    <span className="ml-auto text-[11px] text-ink-400">
                      {formatRelative(s.capturedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {filtered.length > 120 && (
            <p className="border-t border-line-200 px-5 py-3 text-center text-[12px] text-ink-500">
              Showing the 120 most recent of {filtered.length} matching scans. Narrow the filters, or
              export the full set to CSV.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
