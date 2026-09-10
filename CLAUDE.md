# SIH26034 — Legal Metrology Compliance Checker

Scans packaged-product labels and flags missing or incorrect mandatory declarations
under India's Legal Metrology (Packaged Commodities) Rules, 2011, for field
enforcement officers.

## Read this first, every session

1. **`docs/PROGRESS.md`** is the source of truth for state — what is done, what is in
   progress, what to pick up next, and every decision already made. Read it before
   doing anything else. Do not re-derive state from git log.
2. **`docs/IMPLEMENTATION_PLAN_v2.pdf`** (source: `IMPLEMENTATION_PLAN_v2.md`) is the
   authoritative spec. It supersedes the older `FULL_IMPLEMENTATION_SPEC.pdf` (v1).
   When v1 and v2 disagree, v2 wins.
3. Run `/pickup` to start a work session, `/handoff` to end one.

Do not read the whole plan into context. It is 45 pages. Read only the section the
current task cites — `docs/PROGRESS.md` names it per task.

## Hard constraints

- **Android only. Physical device only. Never an emulator.** The core loop is live
  camera scanning; an emulator's fake camera makes it untestable and its performance
  numbers meaningless. Use `npx expo run:android --device`, `adb devices`, ADB over
  Wi-Fi. Never suggest `emulator` / `avd` commands or emulator fallbacks.
- **No iOS target.**
- The user's own phone is both the dev device and the benchmark device. Latency
  numbers quoted anywhere must come from it.

## Design principles that govern code decisions

These are the tiebreakers. Full statements in plan §3.

- **P1 — The decision layer is deterministic.** OCR/barcode/blur may be statistical.
  The step that turns extracted facts into a flag is a pure function of
  `(fields, geometry, category, rulepack)` with no learned parameters. Every flag
  carries a statute, rule id, sub-clause, and rule-pack version.
- **P2 — ~~Offline first~~ → Accuracy first. SUPERSEDED 2026-09-10 by user decision.**
  The plan (§3) and `IMPLEMENTATION_PLAN_v2.pdf` still read *"the device must reach a
  verdict alone; network is an enhancement path, never a dependency."* **That is no longer
  what is being built.** The most accurate reachable engine decides the verdict:
  **self-hosted PaddleOCR (server models) by default**, ML Kit for the live preview only
  and never for a verdict. With no provider reachable the app **refuses to give a verdict**
  rather than degrading to on-device OCR. Reason: a result an officer cannot trust sends
  them back to manual inspection, which is the problem this tool exists to remove.
  Cloud Vision is **parked, not chosen** — it needs a card on file and there is no budget;
  a free escalation ladder is in `DEMO_PLAN` §2.1. The OCR host is the user's laptop for
  dev and demo (no internet) and a cloud host in real deployment — the endpoint is
  configuration, not code.
  The plan is now divergent here and v2 does **not** win on this one point — the decisions
  log does. See `docs/PROGRESS.md` (`2026-09-10`, the two `USER DECISION` entries) and
  `docs/DEMO_PLAN.md` §2.1. `T-3.2`, `T-3.4` and `T-6.4` are flagged for re-scope.
- **P3 — A false flag costs more than a missed flag.** Precision is the primary
  metric. Uncertain findings are emitted as `advisory`, never `violation`.
- **P4 — Never emit a number the method cannot support.** No millimetre figure
  without a stated scale reference. `measurement: null` is a valid answer.
- **P5 — Applicability before evaluation.** Ask whether the Rules apply before
  asking whether they are met.
- **P6 — Rules are data, code is an interpreter.** No statutory fact — clause number,
  threshold, unit table, lexicon — may be hard-coded. It lives in `rulepack/*.json`.
- **P7 — Evidence is for a human.** Every flag carries the image region a person can
  look at to agree or disagree.
- **P8 — Measure what you claim.** Accuracy claims come from `eval/`, latency claims
  from recorded per-stage timings.
- **P9 — Degrade visibly.** If Devanagari OCR is unavailable, say so. Never let a
  degraded path look like a clean result.

## Repository layout

```
rulepack/        versioned JSON rule packs — the legal heart of the project
packages/        shared TS (rule-engine-ts) bundled into the app
conformance/     fixtures both evaluators must agree on (CI-gated)
mobile/          React Native + Expo dev-client (Android)
backend/         FastAPI
dashboard/       React + Vite
eval/            gold set + accuracy harness
docs/            plan, progress, rule sources
```

## Working agreements

- **Never hard-code a statutory value.** If you find yourself typing `4` for a
  millimetre threshold or `"6(1)(e)"` in a `.py`/`.ts` file, stop — it belongs in
  the rule pack.
- **Unreviewed thresholds may only produce advisories.** Any rule-pack entry with
  `status: PENDING_LEGAL_REVIEW` is barred from emitting a `violation`. This is
  enforced by a test, not by convention.
- **Both evaluators change together.** Editing the TS evaluator without the Python
  one (or vice versa) breaks the conformance gate. Add a fixture for every behaviour
  change.
- **One task per session.** Finish it, `/handoff`, `/clear`. Do not drift into
  adjacent work — note it in `docs/PROGRESS.md` under Parked instead.
- Commit at the end of a task, not mid-way. Solo repo, single `main` branch, no
  remote — commit directly to `main`.

## Open legal question — unresolved

LMPC sub-clause letters are **not yet verified**. v1 put MRP at 6(1)(f) and the date
at 6(1)(g); common readings put them at 6(1)(e) and 6(1)(d). Everything legal is
marked `PENDING_LEGAL_REVIEW` until a Legal Metrology officer confirms it. Do not
quietly pick one reading and present it as settled.
