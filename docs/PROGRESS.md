# Progress — SIH26034 Legal Metrology Compliance Checker

> Single source of truth for project state. Updated by `/handoff`, read by `/pickup`.
> Keep it terse. This file is read in full every session — every line costs tokens.

**Last updated:** 2026-09-10 · **Sessions completed:** 5 · **Current sprint:** 1 (paused for the demo detour)

---

## Now

> **DETOUR IN PROGRESS — demo app, phases `D-0`…`D-5`.** See `docs/DEMO_PLAN.md` §4 for
> the phase definitions and cut lines. The task board below is unchanged; the demo does
> not advance it. **When `D-5` ships, resume at `T-1.3`.** Demo code (`mobile/`) is
> throwaway scaffolding and must never be promoted into `packages/rule-engine-ts` or
> `rulepack/*.json`.

**Current demo phase:** `D-3` — field trial (tune lexicons/shapes in JSON against ten real packets)
**Status:** not started
**Blocked on:** nothing.

`D-2` is done and verified on the Nord 4 against a real snack packet (Bhujialalji Navratna
Mix). The loop runs at ~1 pass/s, the overlay tracks the label, Freeze produces a verdict
with citations, and `INSUFFICIENT_EVIDENCE` fires on a bad capture. Measured this session:

| stage | Nord 4 (Snapdragon 7+ Gen 3) |
|---|---|
| capture | 310–350 ms |
| OCR (41–71 lines) | 360–860 ms |
| extract + evaluate | sub-millisecond, both pure |

**Freeze takes no picture.** It keeps the last completed pass, already recognised — so the
verdict is instant and the frame on screen is provably the frame it came from (P7).

Two device-only bugs were found and fixed here; both are recorded in the decisions log and
neither is guessable from the code:

1. ML Kit's coordinates are **not** in the frame expo-camera reports. `resolveCoordinateFrame`
   now measures which frame applies. This supersedes the D-1 note that no transposition
   was needed.
2. The loop **stalled dead at pass ~69** — `takePictureAsync` stopped settling, silently,
   behind a live preview. `PASS_TIMEOUT_MS` plus a camera remount on restart now cover it.

**What D-2 did not prove:** the evidence *highlight* has never been seen firing. On every
packet scanned so far each finding was an *absence*, which has no region to point at and
correctly renders "Nothing to highlight". Beat 5's visual needs a declaration that is
present but defective (an MRP without "inclusive of all taxes", a net quantity without a
unit). Find one in `D-3`; the overlay itself is proven exact, since the same code draws the
line boxes pixel-accurately on the frozen frame.

Rebuild and run with `cd mobile && npx expo run:android --device CPH2661`. **The device
name is `CPH2661`, not the adb serial** — `expo run:android --device <serial>` fails with
`Could not find device with name`. Incremental Gradle is ~24 s; the JS bundle ~9 s. JS
edits reload over Metro with no rebuild.

Driving the phone from a session: `adb exec-out screencap -p > shot.png` then read it, and
`adb shell input tap X Y`. Get real hit boxes from
`adb shell uiautomator dump /sdcard/ui.xml` (prefix the command with `MSYS_NO_PATHCONV=1`
in Git Bash, or the `/sdcard` path is mangled into a Windows path). Guessing tap
coordinates off a screenshot is unreliable — a tap that lands during a re-render is dropped.

Demo phases, in priority order. After each one there is still a demo you could give.

- [x] `D-0` Foundations — scaffold, Gradle build green, rule pack, evaluator, unit tests · *no device*
- [x] `D-1` Shell on the phone — one still capture reaches ML Kit and prints text
- [x] `D-2` Core loop — live OCR, freeze, verdict screen with citations · **the demo itself**
- [ ] `D-3` Field trial — tune lexicons/shapes in JSON against ten real packets
- [ ] `D-4` Honest degradation — insufficient evidence, coach hints, aeroplane mode
- [ ] `D-5` Polish and rehearsal — icon, standalone APK, `docs/DEMO_SCRIPT.md`, two run-throughs

One phase per session. `/handoff` at the end of each; do not start the next in the same session.

**Next task (after the demo):** `T-1.3` — `rulepack/lmpc-2011.json`, Rule 6 universal declarations (plan §4.2)
**Status:** not started
**Blocked on:** nothing

Read `rulepack/schema/README.md` first — it is the authoring guide, and shorter than the
schema. `rulepack/schema/examples/valid/full-featured.json` is the worked reference:
every construct the schema allows, with `EXAMPLE` clause numbers. Copy its shape.

For T-1.3 specifically: the pack needs `fields` (its own field vocabulary),
`applicability_gates: []` (the key is required even though gates are T-1.5), and one
declaration rule per finding — a field checked three ways is three rules, so each finding
carries exactly one citation. Everything starts `PENDING_LEGAL_REVIEW`, which the schema
caps at `max_severity: advisory`. Contested sub-clause letters go in
`clause.alternate_readings`, not resolved silently. Validate with `python rulepack/validate.py`.

Nine gates now run green: `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm test`, `ruff check .`, `ruff format --check .`, `pytest`, `npm audit`, and
`python rulepack/validate.py`. Run them before and after any change.

Setup on a fresh clone: `npm install` and `python -m pip install -r requirements-dev.txt`.

**Needed from user:**
- **Keep the Nord 4 connected.** `D-3`…`D-5` all need it. Device name `CPH2661`,
  serial `bac3856a`, camera permission already granted to `com.sih26034.lmscan`.
- **Ten real packets for `D-3`.** At least one must have a declaration that is *present
  but defective* — an MRP with no "inclusive of all taxes", or a net quantity with no unit
  — otherwise the evidence highlight (demo beat 5) still cannot be shown.
- A Legal Metrology officer / law student contact for the rule-pack review (plan §4,
  needed before Sprint 6, ideally started in Sprint 1). **Not yet asked.**
- Docker is not installed on this machine (`docker --version` fails). `T-1.11` needs
  Docker Desktop; install it before that task, not urgently now.

---

## Decisions log

Append-only. One line each. Never re-litigate a line that is already here.

- `2026-09-09` Plan v2 (`docs/IMPLEMENTATION_PLAN_v2.pdf`) supersedes v1. v2 wins on conflict.
- `2026-09-09` Android only, physical device only. No emulator, no iOS target.
- `2026-09-09` Rule engine runs in **both** TS (on-device) and Python (server), held together by a CI conformance suite.
- `2026-09-09` Rules live in versioned JSON (`rulepack/`). No statutory fact hard-coded anywhere.
- `2026-09-09` PaddleOCR is a **server** component, not on-device. On-device OCR is ML Kit only.
- `2026-09-09` Report rendering uses headless Chromium (Playwright), not WeasyPrint.
- `2026-09-09` GEPIR demoted to one of four identity signals; three work offline.
- `2026-09-09` Solo repo, single `main` branch, no remote — commit directly to `main`.
- `2026-09-09` Subagents pinned to `model: sonnet`. Effort level is session-wide (`.claude/settings.json`), not per-agent.
- `2026-09-10` npm workspaces = `packages/*` only. `mobile/` and `dashboard/` join when `T-1.12` / `T-4.4` scaffold them; `conformance/` joins at `T-1.9`. Do not add empty workspaces — `npm install` fails on a workspace with no `package.json`.
- `2026-09-10` TS toolchain: TypeScript 5.9 project references, ESLint 10 flat config with type-aware `recommendedTypeChecked`, Prettier 3, Vitest 5. Python: ruff 0.14 + pytest 8, configured in the root `pyproject.toml`.
- `2026-09-10` Each TS package has a build project (`src`, composite, emits `dist/`) and a sibling test project (`test/tsconfig.json`, emits to gitignored `.tscache/`). Both are referenced from the root `tsconfig.json`, so `tsc -b` typechecks tests too. New packages must follow this shape or ESLint cannot type-check their tests.
- `2026-09-10` `.gitattributes` forces `eol=lf` repo-wide. Windows host, Linux CI — without it Prettier's `endOfLine: lf` check fails on a fresh Windows clone.
- `2026-09-10` Prettier does not touch `docs/`, `.claude/` or any `*.md`. The plan uses custom `~~~t|` table and `:::` admonition syntax that Prettier mangles.
- `2026-09-10` CI gates that cannot run yet exist as jobs emitting a GitHub `::notice::` NOT IMPLEMENTED and exiting 0 — never omitted, never silently green (P9). Each guards on the file it needs and turns into a hard `::error::` failure the moment that file exists without its gate wired. So `T-1.2` creating the schema **will red the `rulepack-schema` job** until the validator step is written in the same task. Same for `T-1.3` → `unreviewed-thresholds`, `T-1.9` → `conformance`, `T-2.9` → `accuracy-regression`.
- `2026-09-10` Rule-pack schema is Draft 2020-12, `schema_version: "2.0"`, in `rulepack/schema/rulepack.schema.json`. Top-level keys: `metadata`, `fields`, `applicability_gates`, `declarations`, `geometry_rules`, `tables`, `lexicons`.
- `2026-09-10` The schema is the interpreter's vocabulary as well as the data contract: `check.kind`, `effect.kind` and predicate ops are **closed enums**, and every params object is closed. Adding a check kind is a deliberate schema change made together with both evaluators plus a conformance fixture. That friction is intended.
- `2026-09-10` A pack declares its own `fields` vocabulary; rules reference field ids from it. No field name is hard-coded in either runtime (P6).
- `2026-09-10` Advisory-only invariant is enforced **structurally**: the schema refuses `max_severity: violation` unless `provenance.status` is `REVIEWED`. `DISPUTED` is capped at advisory too. T-1.9's gate still owns the evaluator-behaviour half.
- `2026-09-10` A rule that can emit a violation must carry `evidence_fields` (P7) — schema-enforced. `height_min_from_table` must declare `requires_scale_reference: true` and `height_parity` must declare `false` (P4) — both fixed by the schema, not left to the author.
- `2026-09-10` Packs store no hash of themselves. The `sha256` in a verdict envelope is computed over the canonical serialisation at load time; a hash inside the object it digests can only be stale.
- `2026-09-10` `rulepack/validate.py` is owned by the pack, not by either evaluator — it needs only `jsonschema`. It runs meta + schema + referential passes and the negative suite. CI's `rulepack-schema` job is now `python rulepack/validate.py` and is a real gate.
- `2026-09-10` Referential integrity (ids resolve, table refs are of the right kind, band tables ascending with one open top band, regexes compile) lives in `validate.py`, not the schema — JSON Schema cannot express cross-references, and §15.4 requires unknown ids to fail the build.
- `2026-09-10` Everything under `rulepack/schema/examples/` is a fixture, never a rule pack: statute code `EXAMPLE`, clause numbers `0(1)(x)`, placeholder reviewer names. `validate.py` treats only `rulepack/*.json` as real packs.
- `2026-09-10` One-day demo detour (`docs/DEMO_PLAN.md`). Scope: live camera → on-device ML Kit OCR → six Rule 6 declarations → deterministic advisory verdict with citations and evidence crops, fully offline. Cut: backend, dashboard, Python evaluator, conformance, Hindi, all geometry/measurement, barcode, applicability gates.
- `2026-09-10` Demo lives in `mobile/` (the real app dir, so `T-1.12` inherits it) but is **not** an npm workspace and is ESLint/Prettier-ignored, so the nine root gates stay green and untouched. Demo rule pack sits at `mobile/src/rulepack/demo-lmpc-v0.json`, deliberately outside `rulepack/*.json` so `validate.py` and the `unreviewed-thresholds` CI gate never see it.
- `2026-09-10` `D-0` done. Expo SDK 57 / RN 0.86 / React 19.2, dev-client, `expo-camera` + `@react-native-ml-kit/text-recognition`. Debug APK builds from cold in ~20 min.
- `2026-09-10` Expo SDK 57 stopped publishing Android SDK versions on `rootProject.ext`, so pre-SDK-53 libraries using `safeExtGet('compileSdkVersion', 28)` silently compile against `compileSdk 28` and fail on modern androidx/ML Kit artefacts. Fixed by the `mobile/plugins/withLegacyGradleExt.js` config plugin — it must be a plugin, not a hand edit, because `android/` is regenerated by prebuild.
- `2026-09-10` `pytest` was failing at HEAD with `ModuleNotFoundError: No module named 'backend'` — the repo root was not on `sys.path`. Fixed with `pythonpath = ["."]` in `[tool.pytest.ini_options]`. Pre-existing, unrelated to the demo; the "nine gates green" claim was stale.
- `2026-09-10` Demo extraction distinguishes *absent* from *malformed* by giving a field two shapes: a loose one used once an anchor has identified the line, and a strict one used for unanchored recovery and by the checks. Without this, `Net Qty: 250` reports as a missing declaration rather than one lacking a standard unit.
- `2026-09-10` Demo live-OCR route: VisionCamera preview + throttled `takeSnapshot()` → `@react-native-ml-kit/text-recognition`. No worklets, no frame-processor plugin — that alignment work belongs to `T-1.12`. All fallback routes' native deps go into the *same* first Gradle build so switching is JS-only.
- `2026-09-10` **`D-1` done and verified on device.** ML Kit's legacy `NativeModules` binding works under RN 0.86 bridgeless / New Architecture on Android 16. Route A stands; routes B and C are never needed. Do not revisit.
- `2026-09-10` **Device is a Snapdragon 7+ Gen 3 (`ro.soc.model=SM7675`, QTI), Android 16 / API 36 — not the Dimensity 7300 previously recorded.** A 7+ Gen 3 is materially quicker than a 7300, so this phone is a *weaker* mid-range stand-in than the board assumed. Every §16 latency number quoted from it must name the chip (P8).
- `2026-09-10` `expo run:android --device` takes the **device name** (`CPH2661`), not the adb serial; a serial fails with `Could not find device with name`.
- `2026-09-10` ML Kit box coordinates arrive in the **capture's own pixel frame** — no transposition needed (measured: extent 4083×3070 against a 4096×3072 capture). `D-2`'s overlay still needs (a) a **clamp**, since an axis-aligned box around a tilted line can overhang the edge (one capture reported bottom 3086 against height 3072), and (b) a **rotation**, since the capture is landscape while the preview is portrait.
- `2026-09-10` Android 15+ forces edge-to-edge, so the app's top banner takes its inset from `StatusBar.currentHeight` (plain JS). `react-native-safe-area-context` was rejected: a native dependency costing a full Gradle rebuild mid-demo for one number the platform already exposes. RN's own `SafeAreaView` is deprecated and warns.
- `2026-09-10` Correction to the `D-0` note below: `mobile/` is **ESLint**-ignored only. Prettier ignores just `mobile/android/` and `mobile/.expo/`, so **mobile sources are format-gated** by `npm run format:check`. D-0's files passed by luck. Run `npx prettier --write` on new mobile files before committing.
- `2026-09-10` **`D-2` done and verified on the Nord 4.** Live loop, overlay, freeze, verdict screen with citations, `INSUFFICIENT_EVIDENCE`. All nine gates green.
- `2026-09-10` **Correction to the D-1 geometry note: ML Kit's coordinates are NOT in the frame expo-camera reports.** Measured extent 2650×3505 against a reported 4096×3072 — a box cannot be taller than its own image. `skipProcessing` returns the sensor's landscape buffer with an EXIF tag; ML Kit honours the tag and reports in the upright frame. `resolveCoordinateFrame` in `projection.ts` now *measures* which frame applies (2% tolerance, so a tilted line's overhang is not mistaken for a transposition) and `OcrFrame.coordinatesTransposed` says so on screen. D-1's reading came from a capture whose extent happened to fit both frames.
- `2026-09-10` **No quarter-turn is ever applied on this route.** `<Image>`, the camera preview and ML Kit all present the EXIF-upright frame, so the frame only needed *transposing*; rotating as well was D-2's one real bug. `rotateBox`/`rotatedSize` are kept, unused, for `T-1.12`'s frame processor, which gets raw buffers with no EXIF to honour.
- `2026-09-10` **Freeze takes no picture.** It reuses the last completed pass. The verdict is then instant (only `extract` + `evaluate`, both pure) and the frame shown is provably the frame cited (P7).
- `2026-09-10` **The scan loop stalls dead at ~pass 69** — `takePictureAsync` stops settling, no error, preview still at 25 fps, counter frozen. That is ~1 minute of scanning, so it lands mid-demo. Fixed by `PASS_TIMEOUT_MS` (6 s, ~7× a healthy pass) on both capture and OCR, and by `Restart scanning` remounting the `CameraView` via a `key` — restarting the loop alone does nothing, the loop is not what is stuck. Root cause not established; treat a stall as expected, not as a one-off.
- `2026-09-10` `expo-file-system` added as a **direct** dependency of `mobile/`. It was already autolinked as a transitive dep of `expo`, so this is a JS-resolution change only — no Gradle rebuild. Used to delete each replaced capture; without it a live loop leaves hundreds of MB of full-resolution JPEGs in the cache during a rehearsal.
- `2026-09-10` Sub-clause letters are concatenated raw from the pack (`Rule 6` + `(1)(d)`), never re-bracketed — the pack already writes its own punctuation, and wrapping produced `Rule 6((1)(d))` on the device (P6).
- `2026-09-10` Bottom-anchored controls reserve `NAV_BAR_INSET = 48` for Android's navigation bar. Same reasoning as the top banner's `StatusBar.currentHeight`: edge-to-edge is forced, the platform exposes no bottom equivalent to JS, and `react-native-safe-area-context` stays rejected.

---

## Open questions

- [ ] **LMPC sub-clause letters unverified.** v1: MRP 6(1)(f), date 6(1)(g). Common reading: MRP 6(1)(e), date 6(1)(d). Everything legal stays `PENDING_LEGAL_REVIEW` until confirmed. *(plan §2.2, §4.2)*
- [ ] Rule 7 height table values are a plausible reconstruction, not verified against the Second Schedule. *(plan §4.3)*
- [ ] Small-quantity exemption thresholds (10 g / 10 ml and carve-outs) unverified. *(plan §4.1)*
- [ ] Best-before attribution — likely FSSAI Labelling & Display Regs 2020, not LMPC. *(plan §2.2)*

---

## Parked

Noticed but deliberately out of scope for now. Do not action without asking.

- `docs/ARCHITECTURE.md` is listed in plan §18 but no task on the board creates it.
  Assign it before Sprint 6. (`docs/DEMO_SCRIPT.md`, the other half of this item, is now
  written by demo phase `D-5`.)
- The demo's Gradle build takes ~20 min from cold but is incremental afterwards. Only a
  native-dependency or `app.json` change forces a rebuild; JS edits reload over Metro.
- No pre-commit hook. The nine checks are run by hand; nothing stops a bad commit
  locally, and CI has never executed because the repo has no remote.
- **No JSON Schema for the verdict envelope.** `rulepack.schema.json` covers the rule
  pack (input); plan §4.5 also specifies the envelope both evaluators emit (output), and
  no task on the board creates a schema for it. `T-1.9` compares verdicts byte-identically,
  which will catch divergence but not a shape both evaluators get wrong together. Decide
  before `T-1.7` whether the envelope gets its own schema.
- **Anchor–value column offset seen on the first real packet** (`D-1`, Bhujialalji Navratna
  Mix). The label panel prints anchors in a left column and values in a right column, and
  the rows do not line up: `150 g` sits vertically level with `DATE OF MANUFACTURE`, not
  with `NET QUANTITY`. Naive "value is the nearest line below the anchor" association will
  mis-attribute. This is exactly what `T-2.3` exists for; `D-3` will meet it first. Do not
  tune the heuristic against this one packet — it is one sample, and P3 says a wrong
  attribution is worse than none.
- `rulepack/CHANGELOG.md` is in the plan §18 layout ("every clause change, dated, with
  reviewer") but no task creates it. Fold it into `T-1.3`, which writes the first pack.
- **The frozen frame sometimes renders sideways.** With `skipProcessing` the EXIF
  orientation varies with how the phone was tilted at the shutter, so one capture displays
  upright and the next lies on its side. **The boxes are correct either way** — `<Image>`
  and ML Kit honour the same tag, so they never disagree with each other. Cosmetic only;
  fix in `D-5` polish, or drop `skipProcessing` in `D-3` and pay the rotate-and-rescale
  latency. Do not "fix" it by rotating the overlay — that reintroduces the bug D-2 removed.
- **`commodity_name` extracted `"may differ."` at `A_anchored_inline` / `high`** from
  "The picture is for representation purpose only, actual product may differ." A confident
  wrong value is precisely what P3 is about. This is `D-3`'s job — tune the lexicon/shape
  in the JSON, and only after seeing several packets, not this one.

---

## Task board

Status: `[ ]` todo · `[>]` in progress · `[x]` done · `[!]` blocked · `[~]` cut/deferred

### Sprint 1 — Legal core and skeleton
*Goal: both evaluators produce identical clause-cited verdicts from a JSON field set.*

- [x] `T-1.1` Repo scaffold — monorepo dirs, tooling, lint/format, CI workflow stub · *plan §18*
- [x] `T-1.2` `rulepack/schema/rulepack.schema.json` — rule-pack JSON Schema · *plan §4.5, §5.2*
- [ ] `T-1.3` `rulepack/lmpc-2011.json` — Rule 6 universal declarations · *plan §4.2*
- [ ] `T-1.4` Rule 7 height table, Rule 8(2) parity, Rule 9 spacing entries · *plan §4.3*
- [ ] `T-1.5` Applicability gate predicates · *plan §4.1*
- [ ] `T-1.6` `docs/RULE_SOURCES.md` — clause → source → reviewer → date · *plan §18*
- [ ] `T-1.7` `packages/rule-engine-ts` — TypeScript evaluator · *plan §5.2*
- [ ] `T-1.8` `backend/app/rules` — Python evaluator · *plan §5.2*
- [ ] `T-1.9` Conformance suite — 60 fixtures + both runners + CI gate · *plan §5.2, §15.4*
- [ ] `T-1.10` FastAPI skeleton, Postgres schema, JWT auth · *plan §5.4, §13.1, §14.1*
- [ ] `T-1.11` `docker-compose.yml` — full offline stack · *plan §17*
- [ ] `T-1.12` RN/Expo dev-client shell on device — camera preview + live ML Kit text boxes · *plan §6, §11*

### Sprint 2 — Extraction and the gold set
*Goal: an eval report with real numbers.*

- [ ] `T-2.1` Text normalisation pass (shared spec, both runtimes) · *plan §7.3*
- [ ] `T-2.2` Cascade Stage A — direct pattern match · *plan §7.2*
- [ ] `T-2.3` Cascade Stage B — anchor–value spatial association · *plan §7.2* **(highest-value task in the project)**
- [ ] `T-2.4` Cascade Stage C — shape-only recovery, advisory-capped · *plan §7.2*
- [ ] `T-2.5` Lexicons `en` / `hi` · *plan §7.4*
- [ ] `T-2.6` Barcode decode + GS1 check digit + prefix region · *plan §6.2, §9.1*
- [ ] `T-2.7` Frame admission — blur, glare, coverage + coach hints · *plan §6.2, §11.3*
- [ ] `T-2.8` **Gold set — 400 labelled images** · *plan §15.1* **(long pole — start day 1)**
- [ ] `T-2.9` `eval/run.py` — metrics harness · *plan §15.3*

### Sprint 3 — Full scan loop
*Goal: end-to-end scan in aeroplane mode, then again online showing refinement.*

- [ ] `T-3.1` Panel capture (full-res, replaces v1 per-field crops) · *plan §6.2 S4*
- [ ] `T-3.2` Upload outbox + resumable idempotent sync · *plan §13.2, §13.3*
- [ ] `T-3.3` OCR adapters behind `OCRProvider` — Cloud Vision + PaddleOCR · *plan §5.1, §17*
- [ ] `T-3.4` On-device provisional verdict · *plan §6.1*
- [ ] `T-3.5` Server refined verdict + merge-in-place · *plan §6.1*
- [ ] `T-3.6` Verdict screen — findings, citations, evidence crops · *plan §11.2*
- [ ] `T-3.7` Scale-free geometry — Rule 8(2) parity, Rule 9 spacing, co-location · *plan §8.2*
- [ ] `T-3.8` `This looks wrong` correction loop · *plan §11.5*

### Sprint 4 — Identity, repository, dashboard

- [ ] `T-4.1` Four-signal identity check · *plan §9.1*
- [ ] `T-4.2` Prior-scan consensus + fuzzy matching (`pg_trgm`) · *plan §9.2*
- [ ] `T-4.3` Offender aggregation by GS1 company prefix + matview · *plan §9.4*
- [ ] `T-4.4` Dashboard shell + Overview · *plan §12*
- [ ] `T-4.5` Scan Explorer · *plan §12*
- [ ] `T-4.6` Offenders view · *plan §12*
- [ ] `T-4.7` Audit hash chain + verification view · *plan §14.2*
- [ ] `T-4.8` Offline scan history + search · *plan §11.2, §13.2*

### Sprint 5 — E-commerce, reports, polish

- [ ] `T-5.1` Batch fetch + HTML text extraction + image OCR · *plan §10.2*
- [ ] `T-5.2` Text-vs-image reconciliation · *plan §10.1*
- [ ] `T-5.3` Batch sweep UI + exports · *plan §10.4, §12*
- [ ] `T-5.4` PDF report via headless Chromium · *plan §17*
- [ ] `T-5.5` Hindi UI localisation (bilingual findings from rule pack) · *plan §11.4*
- [ ] `T-5.6` Sunlight theme, one-handed layout, haptics, battery pass · *plan §11.4*
- [ ] `T-5.7` Calliper measurement tool · *plan §8.3*
- [ ] `T-5.8` Performance pass against §16 budgets on the real device · *plan §16*

### Sprint 6 — Hardening and pitch

- [ ] `T-6.1` Accuracy push driven by eval's ten worst failures · *plan §15.3*
- [ ] `T-6.2` Latency measurement + published histogram · *plan §16.4*
- [ ] `T-6.3` Legal review sign-off recorded in rule pack · *plan §4.5*
- [ ] `T-6.4` Failure-path rehearsal — no network, no quota, no barcode, exempt pack · *plan §20*
- [ ] `T-6.5` Demo script rehearsal ×5 including failure paths · *plan §21*

---

## Cut lines

Decided in advance so the call is not made at midnight under pressure. *(plan §19)*

| Sprint | First thing cut if the sprint runs long |
|---|---|
| 1 | Extended FSSAI/BIS packs — core LMPC only |
| 2 | Hard-conditions stratum drops to 30 images. **Never cut the compliant stratum.** |
| 3 | Co-location clustering (keep parity + spacing) |
| 4 | GEPIR entirely — the three offline identity signals carry the feature |
| 5 | DOCX export and cylindrical unwrap |
| 6 | Nothing. This sprint is protected buffer. |
