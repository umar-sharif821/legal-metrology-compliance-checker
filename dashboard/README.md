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

## What is real, and what is sample

These are two different things and the app keeps them apart, because conflating them
once produced a genuinely dangerous screen.

**Analysing an image is real.** It runs the project's actual engine — `extract`,
`evaluate` and `admit` from `mobile/src/`, the same functions the phone runs and the same
ones the root test suite covers — over real OCR from Tesseract, in your browser. Nothing
is uploaded anywhere. If the image cannot be read, the screen says the read failed and no
verdict is produced. **There is no path that invents a verdict for a real photograph.**

An earlier version had one. With no backend it answered an upload by picking a random
record from the sample corpus and attaching the user's photo to it — a Verka lassi packet
came back as Santoor toilet soap, with evidence boxes drawn over the real image. That
path is deleted, and `sampleScanFor`, the helper that made it easy, is deleted with it.

**The scan repository is sample.** The 148 historical inspections behind Overview and the
Scan explorer come from `src/lib/mock.ts`, because the FastAPI backend is Sprint 3 work
and does not exist. The header says **Sample repository**, and every record carries
`sample: true`. That is a claim about nobody's photograph, which is why the fallback is
acceptable there and not on an upload.

**Nothing anywhere is an accuracy figure.** Stage timings are measured on this machine
for this image, and are labelled indicative rather than benchmark. Accuracy for this
project comes from `eval/`; neither is wired in here.

### Offline by construction

`public/tesseract/` holds the worker, the wasm cores and the English language data — 30 MB,
committed. Nothing is fetched from a CDN, so the analysis works with the network unplugged
(P2) and cannot fail because a venue's wifi is bad.

Only the `-lstm` wasm variants are vendored, which is what tesseract.js selects by default.
It picks one at runtime by CPU feature detection, so all three are present: plain, `simd`
and `relaxedsimd`. Deleting the one your browser happens not to use will break somebody
else's machine — this was found the hard way, as a `failed to load` error mid-scan.

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
