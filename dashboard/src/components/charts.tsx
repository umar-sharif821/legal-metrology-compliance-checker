/**
 * Hand-rolled SVG charts.
 *
 * COLOUR DECISION, recorded because it changed the design: the obvious form for the
 * status mix was one stacked bar — clear / attention / refused. Running the palette
 * validator killed it. Green `#0ca30c` against amber `#d9860a` measures ΔE 1.7 under
 * protanopia: for a red-green colour-blind viewer those two touching segments are one
 * segment. Rather than tint the amber until it stopped being amber, the form changed —
 * the mix is three separate tiles, each a single series, each identified by an icon and
 * a word as well as a colour. Every chart in this file is therefore single-series, which
 * is also why none of them carries a legend: the title names the one thing plotted.
 *
 * Marks follow one spec throughout: 2px lines, ≤24px bars with a 4px rounded data-end
 * squared at the baseline, ≥8px markers ringed in the surface colour, hairline grid.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export const SERIES = '#2a78d6';
export const TONE_MARK = {
  clear: '#0ca30c',
  advisory: '#d9860a',
  unknown: '#64748b',
  violation: '#d03b3b',
} as const;

const GRID = '#e3e8f0';
const AXIS_INK = '#7d8ba3';
const SURFACE = '#ffffff';

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function Tooltip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  // Flip to the left of the cursor when it would overflow the right edge.
  const flip = x > w - 150;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[9rem] rounded-lg border border-line-200 bg-surface px-2.5 py-2 text-[11.5px] shadow-pop"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? w - x + 12 : undefined,
        top: Math.max(4, y - 44),
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — 12-ish points, no axes, current value marked.
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  tone = 'clear',
  height = 30,
}: {
  values: readonly number[];
  tone?: keyof typeof TONE_MARK;
  height?: number;
}) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const stroke = TONE_MARK[tone];
  const pad = 4;
  const max = Math.max(1, ...values);
  const n = values.length;

  const pt = (i: number, v: number): [number, number] => [
    pad + (i / Math.max(1, n - 1)) * (w - pad * 2),
    height - pad - (v / max) * (height - pad * 2),
  ];

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${pt(i, v).join(' ')}`).join(' ');
  const last = n > 0 ? pt(n - 1, values[n - 1] as number) : null;

  return (
    <div ref={ref} style={{ height }} className="w-full">
      {w > 0 && n > 1 && (
        <svg width={w} height={height} aria-hidden>
          <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
          {last && (
            <circle cx={last[0]} cy={last[1]} r={3.5} fill={stroke} stroke={SURFACE} strokeWidth={2} />
          )}
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend — one series over time, with a crosshair tooltip.
// ---------------------------------------------------------------------------

export interface TrendPoint {
  readonly label: string;
  /** Null breaks the line rather than interpolating across a day with no data. */
  readonly value: number | null;
  readonly detail?: ReactNode;
}

export function TrendChart({
  points,
  height = 200,
  format = (v: number) => `${Math.round(v * 100)}%`,
  domain = [0, 1],
}: {
  points: readonly TrendPoint[];
  height?: number;
  format?: (v: number) => string;
  domain?: readonly [number, number];
}) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 38;
  const padR = 14;
  const padT = 12;
  const padB = 24;
  const plotW = Math.max(0, w - padL - padR);
  const plotH = height - padT - padB;
  const [lo, hi] = domain;
  const n = points.length;

  const xAt = (i: number) => padL + (i / Math.max(1, n - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

  // Break into contiguous runs so gaps stay gaps.
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ i, v: p.value });
    }
  });
  if (run.length) runs.push(run);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const i = Math.round(((x - padL) / Math.max(1, plotW)) * (n - 1));
      setHover(i >= 0 && i < n ? i : null);
    },
    [plotW, n],
  );

  const ticks = [lo, lo + (hi - lo) / 2, hi];
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Trend over the last 30 days">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={yAt(t)} y2={yAt(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={padL - 8}
                y={yAt(t) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={AXIS_INK}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {format(t)}
              </text>
            </g>
          ))}

          {runs.map((r, k) => {
            const d = r.map((p, j) => `${j === 0 ? 'M' : 'L'}${xAt(p.i)} ${yAt(p.v)}`).join(' ');
            const area =
              r.length > 1
                ? `${d} L${xAt(r[r.length - 1]!.i)} ${yAt(lo)} L${xAt(r[0]!.i)} ${yAt(lo)} Z`
                : '';
            return (
              <g key={k}>
                {area && <path d={area} fill={SERIES} opacity={0.1} />}
                <path
                  d={d}
                  fill="none"
                  stroke={SERIES}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {r.length === 1 && (
                  <circle cx={xAt(r[0]!.i)} cy={yAt(r[0]!.v)} r={3} fill={SERIES} />
                )}
              </g>
            );
          })}

          {/* x labels: first, middle, last only — a tick per day is unreadable */}
          {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              fontSize={10}
              fill={AXIS_INK}
            >
              {points[i]?.label ?? ''}
            </text>
          ))}

          {hovered && hovered.value !== null && hover !== null && (
            <g>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={padT}
                y2={padT + plotH}
                stroke={AXIS_INK}
                strokeWidth={1}
                opacity={0.45}
              />
              <circle
                cx={xAt(hover)}
                cy={yAt(hovered.value)}
                r={4.5}
                fill={SERIES}
                stroke={SURFACE}
                strokeWidth={2}
              />
            </g>
          )}

          {/* No direct end-label here on purpose: the hero figure beside this chart is
              already the current value, and at the right edge the label collided with
              the top axis tick. One statement of a number, not two. */}
        </svg>
      )}

      {hovered && hover !== null && (
        <Tooltip x={xAt(hover)} y={hovered.value === null ? height / 2 : yAt(hovered.value)} w={w}>
          <p className="font-semibold text-ink-900">{hovered.label}</p>
          {hovered.value === null ? (
            <p className="mt-0.5 text-ink-500">No conclusive scans</p>
          ) : (
            <p className="mt-0.5 tnum text-ink-700">{format(hovered.value)}</p>
          )}
          {hovered.detail && <div className="mt-1 text-ink-500">{hovered.detail}</div>}
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar list — ranked magnitude, one series.
// ---------------------------------------------------------------------------

export interface BarRow {
  readonly key: string;
  readonly label: ReactNode;
  readonly sub?: ReactNode;
  readonly value: number;
  readonly detail?: ReactNode;
  readonly onClick?: () => void;
}

export function BarList({
  rows,
  format = (v: number) => v.toLocaleString('en-IN'),
  max,
}: {
  rows: readonly BarRow[];
  format?: (v: number) => string;
  max?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="flex flex-col">
      {rows.map((r) => {
        const pct = (r.value / top) * 100;
        const active = hover === r.key;
        const Tag = r.onClick ? 'button' : 'div';
        return (
          <li key={r.key} className="border-b border-line-200 last:border-0">
            <Tag
              {...(r.onClick ? { onClick: r.onClick, type: 'button' as const } : {})}
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
              className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                r.onClick ? 'cursor-pointer hover:bg-canvas' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] text-ink-900">{r.label}</div>
                {r.sub && <div className="mt-0.5 truncate text-[11px] text-ink-500">{r.sub}</div>}
                {/* 14px bar, 4px rounded data-end, square at the baseline */}
                <div className="mt-1.5 h-3.5 w-full">
                  <svg width="100%" height={14} preserveAspectRatio="none" aria-hidden>
                    <rect x={0} y={0} width="100%" height={14} rx={0} fill="#f1f4f9" />
                    <rect
                      x={0}
                      y={0}
                      width={`${Math.max(pct, r.value > 0 ? 1.2 : 0)}%`}
                      height={14}
                      fill={SERIES}
                      opacity={active ? 1 : 0.85}
                      style={{ transition: 'opacity .15s' }}
                      rx={4}
                    />
                    {/* square off the baseline end that rx rounded */}
                    {r.value > 0 && (
                      <rect x={0} y={0} width={4} height={14} fill={SERIES} opacity={active ? 1 : 0.85} />
                    )}
                  </svg>
                </div>
              </div>
              <div className="tnum w-14 shrink-0 text-right text-[13px] font-semibold text-ink-900">
                {format(r.value)}
              </div>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
