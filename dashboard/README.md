# Dashboard — Legal Metrology Compliance Checker (web)

React + Vite + Tailwind. The PC-facing half of SIH26034: upload or capture a label,
get a compliance report with citations and evidence, and browse the repository of past
scans.

## Run it

```bash
cd dashboard
npm install       # once
npm run dev       # http://localhost:5173
```

No backend is required. See "Sample data" below.

```bash
npm run build     # typecheck + production bundle into dist/
npm run preview   # serve the production bundle
```

## Screens

| Route | What it is |
| --- | --- |
| `/` | Overview — hero clear-rate, four drill-through tiles, 30-day trend, most-flagged declarations, declaration presence, category and district breakdowns |
| `/scan` | Upload or camera capture, staged analysis progress, frame-quality criteria |
| `/scans` | Scan explorer — URL-backed search and filters, CSV export |
| `/scans/:id` | Compliance report — evidence, declarations, per-rule checks, printable notice |
| `/rulepack` | The active rule pack, its review status, and every clause's verification state |

## Sample data, and why it says so on screen

The FastAPI backend is Sprint 3 work and does not exist yet. Every call in
`src/lib/api.ts` tries the real endpoint first with a 2.5 s timeout, then falls back to
the bundled corpus in `src/lib/mock.ts`.

The fallback is never silent. The header shows **Sample data** or **Live backend**, each
record carries `sample: true`, and the report says the record came from the corpus. A
demo that cannot tell you whether it just talked to a server will eventually mislead the
person watching it.

**Nothing on any screen is a measurement.** The stage timings are indicative values, not
recorded ones, and the screen says so. Accuracy figures for this project come from
`eval/`, latency from recorded per-stage timings on the benchmark device — neither is
wired in here.

## Where the legal content comes from

No clause number, sub-clause letter, declaration title, requirement, remedy or threshold
is written anywhere in `src/`. All of it is read from the rule pack through
`src/lib/rulepack.ts`, which imports the pack via the `@rulepack` alias in
`vite.config.ts`.

That alias currently points at the **demo** pack under `mobile/`. Pointing the dashboard
at the real pack is a one-line change in `vite.config.ts`; nothing in `src/` moves,
because every consumer goes through `rulepack.ts`.

Consequences you will see on screen, all of them driven by pack data rather than by
code:

- Every severity is capped at **advisory**, because the pack's provenance says
  `PENDING_LEGAL_REVIEW`. A reviewed pack lifts the cap with no code change.
- Contested sub-clause letters render with a `*` and the competing reading beside them.
  The open question about Rule 6(1) letters is shown, not resolved.
- The frame-quality block names **blur and glare as unmeasured**, on every report,
  including passing ones.

## Notes for whoever picks this up

- Not an npm workspace, and excluded from the root ESLint config — same arrangement as
  `mobile/`, for the same reason (its tsconfig is outside the root project graph). It is
  typechecked by `npm run typecheck` inside this directory.
- Charts are hand-rolled inline SVG in `src/components/charts.tsx`. Every chart is
  single-series on purpose — a stacked clear/attention/refused bar failed colour-vision
  separation (ΔE 1.7 under protanopia), so the status mix became separate tiles instead.
  The reasoning is in the file header.
- `T-4.4`–`T-4.6` are the real versions of these screens, against a real backend.
