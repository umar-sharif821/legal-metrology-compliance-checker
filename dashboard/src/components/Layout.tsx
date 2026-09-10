/**
 * The application frame.
 *
 * The advisory strip under the header is not decoration and is not dismissible. While
 * the rule pack is unreviewed no finding in this application may be presented as a
 * determination of law, and the wording is read from the pack rather than written here.
 * A compliance tool that lets its own caveat scroll away is a compliance tool that will
 * eventually be quoted without it.
 */
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  IconBook,
  IconClose,
  IconGrid,
  IconList,
  IconMenu,
  IconScales,
  IconScan,
  IconShield,
} from './icons';
import { ADVISORY_ONLY, PACK } from '../lib/rulepack';
import { useScans } from '../lib/store';

const NAV = [
  { to: '/', label: 'Overview', icon: IconGrid, end: true },
  { to: '/scan', label: 'New scan', icon: IconScan, end: false },
  { to: '/scans', label: 'Scan explorer', icon: IconList, end: false },
  { to: '/rulepack', label: 'Rule pack', icon: IconBook, end: false },
] as const;

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white/90'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon width={17} height={17} className={isActive ? '' : 'opacity-80'} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-navy-900">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
          <IconScales width={19} height={19} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">Legal Metrology</p>
          <p className="truncate text-[11px] text-white/50">Compliance Checker</p>
        </div>
      </div>

      <div className="mt-2 flex-1">
        <NavItems onNavigate={onNavigate} />
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[10.5px] tracking-[0.08em] text-white/40 uppercase">Active rule pack</p>
        <p className="mt-1.5 font-mono text-[11.5px] text-white/85">
          {PACK.id} <span className="text-white/45">v{PACK.version}</span>
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded border border-advisory-line/30 bg-advisory-mark/15 px-1.5 py-0.5 text-[10px] font-medium text-advisory-mark">
          <IconShield width={11} height={11} />
          {PACK.provenanceStatus.replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { origin, loading } = useScans();
  const { pathname } = useLocation();
  // Exact match only. Prefix matching put "Scan explorer" above a single report, and
  // `/scans` would also have matched `/scan`. A detail route falls through to its own
  // title instead.
  const current = NAV.find((n) => n.to === pathname);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade absolute inset-0 bg-navy-950/50"
            onClick={() => setOpen(false)}
          />
          <div className="animate-slide-in absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-30 border-b border-line-200 bg-surface/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="-ml-1 rounded-lg p-2 text-ink-700 hover:bg-canvas lg:hidden"
              aria-label="Open navigation"
            >
              {open ? <IconClose /> : <IconMenu />}
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[14px] font-semibold text-ink-900">
                {current?.label ?? 'Compliance report'}
              </h1>
              <p className="truncate text-[11.5px] text-ink-500">{PACK.statuteLong}</p>
            </div>

            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
                origin === 'live'
                  ? 'border-clear-line bg-clear-bg text-clear-ink'
                  : 'border-unknown-line bg-unknown-bg text-unknown-ink'
              }`}
              title={
                origin === 'live'
                  ? 'The scan repository is coming from the backend.'
                  : 'No backend answered, so the scan repository below is the bundled sample corpus. It says nothing about an image you analyse here — those are read on this device.'
              }
            >
              <span
                className={`size-1.5 rounded-full ${
                  origin === 'live' ? 'bg-clear-mark' : 'bg-unknown-mark'
                }`}
              />
              {loading
                ? 'Connecting…'
                : origin === 'live'
                  ? 'Live repository'
                  : 'Sample repository'}
            </span>
          </div>

          {ADVISORY_ONLY && (
            <div className="flex items-start gap-2 border-t border-advisory-line bg-advisory-bg px-4 py-2 text-[11.5px] leading-snug text-advisory-ink sm:px-6">
              <IconShield width={14} height={14} className="mt-px shrink-0" />
              <p>
                <b className="font-semibold">Advisory only.</b> The active rule pack is{' '}
                {PACK.provenanceStatus.replace(/_/g, ' ').toLowerCase()} — every finding is capped
                at <b className="font-semibold">advisory</b> and none may be presented as a
                determination of law.
              </p>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>

        <footer className="border-t border-line-200 px-4 py-4 text-[11px] text-ink-400 sm:px-6">
          SIH26034 · {PACK.statuteCode} · rule pack {PACK.id} v{PACK.version} · {PACK.jurisdiction}{' '}
          — findings require confirmation by a Legal Metrology officer.
        </footer>
      </div>
    </div>
  );
}
