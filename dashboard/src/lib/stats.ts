/**
 * Aggregates for the Overview screen.
 *
 * Every figure on that screen is computed here from the same scan list the Scan
 * Explorer renders, so a tile can never disagree with the table it links into. Plan
 * §12: "a dashboard number that cannot be drilled into is decoration" — the corollary
 * is that a number computed from a different source than its drill-down is worse than
 * decoration, it is a bug with a confident face.
 */
import { DECLARATIONS_BY_ID } from './rulepack';
import { dayKey } from './format';
import type { Scan } from './types';

export interface DayPoint {
  readonly day: string;
  readonly scans: number;
  readonly attention: number;
  readonly clear: number;
  readonly insufficient: number;
  /** Share of *conclusive* scans with no issue found. Refused frames are excluded — */
  /** counting a refusal as a pass or a fail would both be wrong. */
  readonly clearRate: number | null;
  /**
   * The same rate over a 7-day trailing window.
   *
   * At roughly five scans a day the single-day rate swings between 0% and 100% on one
   * package and reads as noise. The window is stated on the axis label rather than
   * applied silently — a smoothed line presented as a daily one is a small lie.
   */
  readonly clearRate7: number | null;
}

export interface RuleTally {
  readonly declarationId: string;
  readonly title: string;
  readonly cite: string;
  readonly contested: boolean;
  readonly count: number;
}

export interface Tally {
  readonly key: string;
  readonly count: number;
  readonly total: number;
}

export interface Stats {
  readonly total: number;
  readonly attention: number;
  readonly clear: number;
  readonly insufficient: number;
  readonly findings: number;
  readonly conclusive: number;
  readonly clearRate: number | null;
  readonly refusalRate: number;
  readonly byDay: readonly DayPoint[];
  readonly topRules: readonly RuleTally[];
  readonly byCategory: readonly Tally[];
  readonly byDistrict: readonly Tally[];
  readonly declarationCoverage: readonly {
    readonly fieldId: string;
    readonly label: string;
    readonly shortLabel: string;
    readonly found: number;
    readonly of: number;
  }[];
}

export function computeStats(scans: readonly Scan[], days = 30): Stats {
  const total = scans.length;
  const attention = scans.filter((s) => s.status === 'ATTENTION').length;
  const clear = scans.filter((s) => s.status === 'NO_ISSUES_FOUND').length;
  const insufficient = scans.filter((s) => s.status === 'INSUFFICIENT_EVIDENCE').length;
  const conclusive = attention + clear;
  const findings = scans.reduce((n, s) => n + s.findings.length, 0);

  // --- daily series, gap-filled so the x-axis is time and not row index ---
  const buckets = new Map<
    string,
    { scans: number; attention: number; clear: number; insufficient: number }
  >();
  for (const s of scans) {
    const k = dayKey(s.capturedAt);
    const b = buckets.get(k) ?? { scans: 0, attention: 0, clear: 0, insufficient: 0 };
    b.scans += 1;
    if (s.status === 'ATTENTION') b.attention += 1;
    else if (s.status === 'NO_ISSUES_FOUND') b.clear += 1;
    else b.insufficient += 1;
    buckets.set(k, b);
  }

  const raw: Omit<DayPoint, 'clearRate7'>[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86400000);
    const k = dayKey(d.toISOString());
    const b = buckets.get(k) ?? { scans: 0, attention: 0, clear: 0, insufficient: 0 };
    const conclusiveDay = b.attention + b.clear;
    raw.push({
      day: k,
      scans: b.scans,
      attention: b.attention,
      clear: b.clear,
      insufficient: b.insufficient,
      clearRate: conclusiveDay === 0 ? null : b.clear / conclusiveDay,
    });
  }

  const byDay: DayPoint[] = raw.map((d, i) => {
    const window = raw.slice(Math.max(0, i - 6), i + 1);
    const c = window.reduce((n, x) => n + x.clear, 0);
    const conc = window.reduce((n, x) => n + x.clear + x.attention, 0);
    return { ...d, clearRate7: conc === 0 ? null : c / conc };
  });

  // --- which declaration is flagged most often ---
  const ruleCounts = new Map<string, number>();
  for (const s of scans) {
    for (const f of s.findings) {
      ruleCounts.set(f.declarationId, (ruleCounts.get(f.declarationId) ?? 0) + 1);
    }
  }
  const topRules: RuleTally[] = [...ruleCounts.entries()]
    .map(([declarationId, count]) => {
      const d = DECLARATIONS_BY_ID.get(declarationId);
      return {
        declarationId,
        title: d?.title ?? declarationId,
        cite: d?.clause.cite ?? '—',
        contested: d?.clause.contested ?? false,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const tally = (get: (s: Scan) => string): Tally[] => {
    const m = new Map<string, { count: number; total: number }>();
    for (const s of scans) {
      const k = get(s);
      const e = m.get(k) ?? { count: 0, total: 0 };
      e.total += 1;
      if (s.status === 'ATTENTION') e.count += 1;
      m.set(k, e);
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, count: v.count, total: v.total }))
      .sort((a, b) => b.count - a.count || b.total - a.total);
  };

  // --- how often each declaration was actually present, across the corpus ---
  const coverage = new Map<
    string,
    { label: string; shortLabel: string; found: number; of: number }
  >();
  for (const s of scans) {
    if (s.status === 'INSUFFICIENT_EVIDENCE') continue;
    for (const f of s.fields) {
      const e = coverage.get(f.fieldId) ?? {
        label: f.label,
        shortLabel: f.shortLabel,
        found: 0,
        of: 0,
      };
      e.of += 1;
      if (f.found) e.found += 1;
      coverage.set(f.fieldId, e);
    }
  }

  return {
    total,
    attention,
    clear,
    insufficient,
    findings,
    conclusive,
    clearRate: conclusive === 0 ? null : clear / conclusive,
    refusalRate: total === 0 ? 0 : insufficient / total,
    byDay,
    topRules,
    byCategory: tally((s) => s.category),
    byDistrict: tally((s) => s.district),
    declarationCoverage: [...coverage.entries()]
      .map(([fieldId, v]) => ({ fieldId, ...v }))
      .sort((a, b) => a.found / a.of - b.found / b.of),
  };
}
