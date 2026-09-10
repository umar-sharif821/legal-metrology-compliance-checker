/**
 * Shared primitives.
 *
 * The one rule that is not negotiable in here: a status is never carried by colour
 * alone. Every status badge ships an icon and a word, so it survives colour-vision
 * deficiency, a bad projector and a black-and-white printout.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconAlert, IconCheck, IconClose, IconHelp, IconInfo } from './icons';
import type { ScanStatus } from '../lib/types';
import type { Severity } from '../lib/rulepack';

// ---------------------------------------------------------------------------
// Status vocabulary
// ---------------------------------------------------------------------------

export const STATUS_META: Record<
  ScanStatus,
  { label: string; short: string; tone: 'clear' | 'advisory' | 'unknown'; blurb: string }
> = {
  NO_ISSUES_FOUND: {
    label: 'No issues found',
    short: 'Clear',
    tone: 'clear',
    blurb:
      'Every declaration this rule pack checks was present and well-formed. This is not a certificate of compliance — only the checked declarations were checked.',
  },
  ATTENTION: {
    label: 'Needs attention',
    short: 'Attention',
    tone: 'advisory',
    blurb: 'At least one declaration did not pass. Each finding cites the rule it comes from.',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Insufficient evidence',
    short: 'Refused',
    tone: 'unknown',
    blurb:
      'The capture could not support a verdict, so none was offered. The failed check is named below.',
  },
};

const TONE_CLASS = {
  clear: 'bg-clear-bg text-clear-ink border-clear-line',
  advisory: 'bg-advisory-bg text-advisory-ink border-advisory-line',
  violation: 'bg-violation-bg text-violation-ink border-violation-line',
  unknown: 'bg-unknown-bg text-unknown-ink border-unknown-line',
} as const;

export type Tone = keyof typeof TONE_CLASS;

const TONE_ICON = {
  clear: IconCheck,
  advisory: IconAlert,
  violation: IconAlert,
  unknown: IconHelp,
} as const;

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: ScanStatus;
  size?: 'sm' | 'md';
}) {
  const meta = STATUS_META[status];
  const Icon = TONE_ICON[meta.tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        TONE_CLASS[meta.tone]
      } ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon width={size === 'sm' ? 12 : 13} height={size === 'sm' ? 12 : 13} strokeWidth={2.1} />
      {size === 'sm' ? meta.short : meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: Tone = severity === 'violation' ? 'violation' : 'advisory';
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase ${TONE_CLASS[tone]}`}
    >
      <Icon width={11} height={11} strokeWidth={2.2} />
      {severity}
    </span>
  );
}

export function Pill({
  children,
  tone = 'unknown',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

/** A statute citation. Monospace so a clause number reads as an identifier. */
export function ClauseChip({
  cite,
  contested,
  title,
}: {
  cite: string;
  contested?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ${
        contested
          ? 'border-advisory-line bg-advisory-bg text-advisory-ink'
          : 'border-line-200 bg-canvas text-ink-700'
      }`}
    >
      {cite}
      {contested && <span aria-label="sub-clause letter contested">*</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = '',
  as: As = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <As className={`card ${className}`}>{children}</As>;
}

export function CardHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-200 px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-[0.02em] text-ink-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary:
      'bg-navy-600 text-white hover:bg-navy-700 active:bg-navy-800 shadow-sm disabled:bg-ink-400',
    secondary:
      'bg-surface text-ink-900 border border-line-300 hover:bg-canvas hover:border-ink-400 disabled:text-ink-400',
    ghost: 'text-ink-700 hover:bg-canvas hover:text-ink-900',
    danger: 'bg-violation-ink text-white hover:opacity-90',
  } as const;
  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9.5 px-4 text-[13px] gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
  } as const;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-canvas text-ink-400 ring-1 ring-line-200">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A short, quiet note. Used for the honesty statements, which must not look decorative. */
export function Note({
  tone = 'unknown',
  icon,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-2.5 rounded-lg border px-3.5 py-3 text-[12.5px] leading-relaxed ${TONE_CLASS[tone]} ${className}`}
    >
      {icon !== undefined ? icon : <IconInfo width={15} height={15} className="mt-px shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}

const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = next.current++;
    setToasts((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 6000);
  }, []);

  const dismiss = (id: number) => setToasts((xs) => xs.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,26rem)] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = TONE_ICON[t.tone];
          return (
            <div
              key={t.id}
              className={`animate-slide-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-pop ${TONE_CLASS[t.tone]}`}
            >
              <Icon width={16} height={16} strokeWidth={2} className="mt-px shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[12px] leading-snug opacity-90">{t.body}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
              >
                <IconClose width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------------------

/** Counts up to `value` once, on mount. Skipped entirely under reduced motion. */
export function useCountUp(value: number, ms = 700): number {
  const [n, setN] = useState(value);
  const prefersReduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (prefersReduced) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, prefersReduced]);

  return n;
}
