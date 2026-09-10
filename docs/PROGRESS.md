# Progress — SIH26034 Legal Metrology Compliance Checker

> Single source of truth for project state. Updated by `/handoff`, read by `/pickup`.
> Keep it terse. This file is read in full every session — every line costs tokens.

**Last updated:** 2026-09-10 · **Sessions completed:** 7 · **Current sprint:** 1 (paused for the demo detour)

---

## Now

> **DETOUR IN PROGRESS — demo app, phases `D-0`…`D-5`.** See `docs/DEMO_PLAN.md` §4 for
> the phase definitions and cut lines. The task board below is unchanged; the demo does
> not advance it. **When `D-5` ships, resume at `T-1.3`.** Demo code (`mobile/`) is
> throwaway scaffolding and must never be promoted into `packages/rule-engine-ts` or
> `rulepack/*.json`.

**Current demo phase:** `D-3` — field trial
**Status:** in progress — tooling done, **all four measured defects fixed**, corpus green;
**2 of 10 packets recorded**
**Blocked on:** the user has only one packet. `D-3` cannot finish without eight or nine more.

**All nine gates are green.** `npm test` was red on four `corpus.test.ts` failures from the
first field trial; those are the four defects fixed this session (see below). Both records
now replay to the verdict their reviewer expected. The next packet recorded will red the
suite again until somebody writes its `expect` block — that is the mechanism working, not
a breakage.

### The corpus and how it works

`mobile/field-trial/NNN-<slug>.json` is one real packet's raw OCR lines, recorded on the
device and pulled with `mobile/scripts/pull-field-trial.sh`. `corpus.test.ts` replays each
through the real `extract` → `evaluate` path and **fails any record with no `expect` block**
— so recording a packet reds the suite until a person has decided what the app *should*
have made of it. Same rule as the CI gates: never silently green. `mobile/field-trial/README.md`
is the authoring guide. JPEGs are gitignored (3.6 MB each); the JSON is the replay corpus,
since tuning changes lexicons and shapes, which operate on lines.

Record with the **Record** control on the verdict screen (`FieldTrialBar.tsx`) — name the
packet, tap Record. It is its own file and its own strip of screen so `D-5` can delete it
with one import and one element.

### What D-3 measured, and what was done about it

Both records are the *same compliant packet* (Lay's/PepsiCo bhujia namkeen). It has all six
declarations printed. **The app flagged it `ATTENTION` both times and every finding was
false.** That is the P3 failure the demo exists to prevent, found on the first real packet.
Four root causes were established; all four are now closed.

1. **Anchor matching had no word boundary. FIXED (TS).** `findAnchorEnd` was a bare
   `line.indexOf(anchor)`. The `commodity_name` lexicon holds `"product"`, the line read
   `ingredients: cereal products (6779%)`, so it matched *inside* `products` and returned
   `"s (6779%) (rice meal (44%),"` at **high** confidence. Now the boundary is required
   only on the sides where the anchor itself ends in a letter or digit — so `product`
   cannot match inside `products`, while `m.r.p.` and `net qty.` still match when they run
   into following punctuation, which a `\b` regex would refuse. Every occurrence in a line
   is tried, not just the first.
2. **Stage B paired by list index with no geometry at all. GUARDED (TS), not solved.**
   In record 001 it paired `NET QTY:` (idx 30, y=3365) with `Pee 100g` (idx 31, y=1697) —
   the nutrition table's "Per 100 g", 1668 px away in another column. Stage B now requires
   the candidate's bottom edge to fall below the anchor's top edge. That is the weakest
   test that is still true by definition of what Stage B claims to do, and it introduces
   **no distance threshold and no column test** — those are `T-2.3`, chosen against the
   gold set, not against one packet. With no geometry from the engine it degrades to the
   old list-order behaviour.
3. **Stage C matched an FSSAI category code as a quantity. FIXED (JSON).** Record 002
   returned `net_quantity = "15.1g"` out of the category code in
   `PROPRIETARY FOOD--NAMKEEN(15.1)`. The pack's claim that this shape is "distinctive
   enough to recover without an anchor" is what the trial falsified — a nutrition panel is
   full of numbers with mass units. `net_quantity.unanchored_recovery` is now `false`.
   The cost is accepted deliberately: a packet whose `Net Qty` anchor is missed now reports
   the declaration not found, which is an advisory saying *rescan the panel*. That is
   honest about what was read, where `15.1g` was a confident falsehood about what the label
   says (P3, P4).
4. **`LMPC-6-1-MRP-INCLUSIVE` was a false flag on OCR noise. FIXED — but not the way the
   record proposed.** The packet does say "INCL. OF ALL TAXES"; OCR returned
   `MIRP RS. 20/- (NCL. OF 42L TAYES)` and the phrase check failed. The reviewer's note
   said this was "tunable in the lexicon, no code change". **Overruled on inspection.** No
   phrase list fixes it: a literal for that garble overfits the pack to one packet, and a
   short fragment like `ncl` matches almost anything. The check now carries
   `requires_anchored_field: true` — it may only *fail* when the price was located by an
   anchor (stage A or B). Recovered by shape alone the check is skipped, not failed. Saying
   "the prescribed wording is absent" is a claim about what is printed, and a scan that
   could not read the letters M-R-P has no warrant to make it (P3, P9). Where the anchor
   was read, the finding still fires — pinned by a control test. **No fuzzy or
   edit-distance matching exists anywhere in the demo**; character-confusion repair is
   `T-2.1`, measured against the gold set.

**A synthetic fixture had been passing on the strength of defect 1 since `D-0`.**
`COMPLETE_LABEL` is documented as "a label carrying all six declarations" and the suite
reported six found — but the sixth came from the anchor `product` matching inside
`Parle Products Pvt. Ltd.` on the manufacturer line, yielding `s pvt. ltd.` as the
commodity name. No test asserted the *value*, so a fixture that did not carry the
declaration passed a test named for carrying it. The fixture now says `Common Name:
Glucose Biscuits`. Worth remembering when reading any other green synthetic assertion.

**Seven regression tests added** (`extract.test.ts`, `evaluate.test.ts`), each naming the
packet observation behind it, plus a control for the two fixes that make a check *harder*
to fire. The corpus catches these too, but it is two records of one packet; the unit tests
state the rule in terms that survive the corpus being pruned in `D-5`.

**The same packet gives a different verdict every pass** (record 001 found 2 fields, record
002 found 3, sharing none). P1 holds — the decision layer is pure — but its input is
stochastic. Worth stating plainly in the pitch rather than letting it be discovered.

**Evidence highlight: PROVEN.** D-2's open item is closed. `LMPC-6-1-MRP-INCLUSIVE` in
record 002 carries `evidenceBox=True`; tapping the finding draws the amber box over the MRP
line on the frozen frame. Beat 5 has a visual. **Note that fix 4 above removes this exact
flag** — it was a false one. A real present-but-defective declaration is now *wanted*, not
merely preferred, or beat 5 has nothing to point at again.

### Judgement calls in the `expect` blocks — overrule freely

Both records' `notes` fields carry the reasoning. The two that matter:

- Record 002 `net_quantity` expects `null`, not `"84.9 g"`. The true value **is** in the OCR
  at line 49 (`84.9g 78 +i)`, y=2868 x=1475), 19 indices from its anchor at line 30
  (y=3013 x=886). Reaching it needs spatial association — `T-2.3`, code, not JSON. `null`
  is the near-term target because silence beats `15.1g` (P3); `"84.9 g"` is the T-2.3 target.
- Record 001 `commodity_name` expects `null`, though `namkeen` (line 8) is arguably the
  commodity name. Left null: P3 prefers silence, and one packet does not justify a new
  lexicon term.

The records' `extracted` and `verdict` blocks are **deliberately not updated** to match the
fixed code. They are a log of what the device did at record time — a measurement. The
`expect` block is the normative half, and it is the only half the suite reads.

### Device notes learned this session

- `adb devices` showing `unauthorized` is a *different* failure from the device being absent;
  the first needs the on-phone prompt accepted, the second a cable. `pull-field-trial.sh`
  distinguishes them.
- **ADB over Wi-Fi is not available** — Wi-Fi is off on the phone (`settings get global
  wifi_on` = 0, it runs on mobile data). Field trials stay tethered.
- Android's `ls` column-formats under `adb exec-out run-as`; the pull script needs `ls -1`
  or two filenames arrive on one line. Cost one bad pull to find.
- App-private storage needs `adb exec-out run-as <pkg> cat`; `adb pull` cannot reach it.
  `exec-out` (not `shell`) is required or the JPEGs are corrupted by CRLF translation.
- Taps are dropped when they land during a re-render — confirmed repeatedly. Drive the phone
  with a retry loop that checks for the expected screen, never a single blind tap.
- `uiautomator dump` returns garbled bounds for RN ScrollView children mid-scroll. Scroll,
  settle, screenshot, then tap from the screenshot.

Rebuild and run with `cd mobile && npx expo run:android --device CPH2661`. **The device
name is `CPH2661`, not the adb serial.** Incremental Gradle is ~24 s; the JS bundle ~9 s.
JS edits reload over Metro with no rebuild — this session's changes needed none.

**Verifying a JS-only change without touching the phone's screen.** A Metro was already
serving on 8081 (`curl -s localhost:8081/status` → `packager-status:running`; a second
`expo start` just refuses the port). `curl "localhost:8081/index.bundle?platform=android&dev=true&minify=false"`
returns the built bundle — grepping it for a string you just added proves Metro is serving
*this* checkout. Then `adb shell am force-stop` + relaunch and read `adb logcat` for
`PackError` / `rule pack is invalid`: the pack compiles at module load, so a bad pack shows
up there rather than at first scan. Done this session; app reached the scan screen clean.

**Do not launch with `adb shell monkey`.** Even `monkey -p <pkg> -c android.intent.category.LAUNCHER 1`
injects one random event after launching, and it landed on the freeze control — the app
came up already frozen on a verdict. Harmless here, but it is not a clean launch. Use
`adb shell am start -n <pkg>/.MainActivity` instead.

Demo phases, in priority order. After each one there is still a demo you could give.

- [x] `D-0` Foundations — scaffold, Gradle build green, rule pack, evaluator, unit tests · *no device*
- [x] `D-1` Shell on the phone — one still capture reaches ML Kit and prints text
- [x] `D-2` Core loop — live OCR, freeze, verdict screen with citations · **the demo itself**
- [>] `D-3` Field trial — 2/10 packets recorded; tooling done, all four measured defects
      fixed and the corpus green; blocked on packets
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

Nine gates: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
`ruff check .`, `ruff format --check .`, `pytest`, `npm audit`, `python rulepack/validate.py`.
**All nine are green** as of this session. Run them all before and after any change.

Setup on a fresh clone: `npm install` and `python -m pip install -r requirements-dev.txt`.

**Needed from user:**
- **Keep the Nord 4 connected.** `D-3`…`D-5` all need it. Device name `CPH2661`,
  serial `bac3856a`, camera permission already granted to `com.sih26034.lmscan`.
- **A second packet was in front of the camera this session and was not recorded.** The
  smoke-test launch caught a live pass over what looks like a Bhujialalji (Bikaner) bhujia
  packet: 118 OCR lines, **0 of 6 declarations located**, `INSUFFICIENT_EVIDENCE`. Not
  recorded, for two reasons — the frame was a poor one (panel lying sideways, half the
  shot bedsheet), and an unreviewed record reds the suite until a person writes its
  `expect` block, which is the user's call, not this session's. **If that packet is still
  to hand, capture it properly and hit Record — it is packet 3 of 10.**
- **Eight more packets for `D-3`.** The user has one (Lay's bhujia namkeen, recorded
  twice). **This is the blocker.** LMPC covers *any* packaged commodity, so toothpaste, soap,
  shampoo, tea, salt, atta, oil, biscuits, noodles, a medicine box all qualify — variety is
  the point, since the wording varies (`Net Wt.`/`Net Qty`/`Quantity`, g/ml/kg/L, MRP
  phrasings, one- vs two-column panels). Ten captures of one packet would tune the pack to
  that packet.
- Still wanted: a packet with a declaration *genuinely* present but defective. The evidence
  highlight is now proven (see **Now**), but on a *false* flag; a real defect would be better.
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
- `2026-09-10` **`D-3` field-trial corpus is a test fixture, not a log.** `mobile/field-trial/*.json` holds a real packet's raw OCR lines; `corpus.test.ts` replays them through `extract` → `evaluate` and **fails any record without a hand-written `expect` block**. Recording a packet reds `npm test` until a person reviews it — the same "never silently green" rule as the CI gates. Do not weaken this to get the suite green.
- `2026-09-10` Corpus JSON is committed, JPEGs are gitignored (3.6 MB each). Tuning changes lexicons and shapes, which operate on *lines*, so the JSON alone is the replay corpus; the image is only for looking at a packet again.
- `2026-09-10` The recorder is descriptive, never normative: the device writes what the app *did*, a reviewer writes what it *should* do. Having the device write both would enshrine current behaviour as correct.
- `2026-09-10` **First real packet was compliant and the app flagged it, twice, with entirely false findings.** Four root causes established, all in **Now**. The headline one is not a tuning question: `findAnchorEnd` (`normalise.ts:71`) matches anchors with a bare `indexOf`, so the lexicon term `product` matched inside `cereal products` and returned the rest of the word as the value, at high confidence.
- `2026-09-10` **The evidence highlight is proven on device.** D-2's open item is closed — a finding with `evidenceBox` draws the amber box over its source line on the frozen frame.
- `2026-09-10` ADB over Wi-Fi is unavailable on this phone: Wi-Fi is off and it runs on mobile data. Field trials are tethered; do not re-attempt wireless setup.
- `2026-09-10` Driving the phone needs a retry loop that verifies the expected screen after each tap. Single blind taps are dropped when they land during a re-render, repeatedly and unpredictably.
- `2026-09-10` Bottom-anchored controls reserve `NAV_BAR_INSET = 48` for Android's navigation bar. Same reasoning as the top banner's `StatusBar.currentHeight`: edge-to-edge is forced, the platform exposes no bottom equivalent to JS, and `react-native-safe-area-context` stays rejected.
- `2026-09-10` **Anchors match on a boundary, not by `indexOf` and not by `\b`.** The boundary is required only on the sides where the anchor itself ends in a letter or digit, so `product` cannot match inside `products` while `m.r.p.` and `net qty.` still match running into following punctuation — which a `\b`-delimited regex refuses, there being no word boundary between `.` and `:`. All occurrences in a line are tried, not just the first.
- `2026-09-10` **Stage B consults geometry, minimally: the candidate's bottom edge must fall below the anchor's top edge.** No distance threshold and no column test — those are `T-2.3`, chosen against the gold set. This one is not a heuristic being tuned; it is Stage B's own stated claim ("value just below the anchor") finally being checked. With no boxes from the engine it degrades to list order.
- `2026-09-10` **`net_quantity` no longer recovers from shape alone.** The pack's claim that a number-plus-unit is "distinctive enough to recover without an anchor" was falsified by record 002, which read `15.1g` out of an FSSAI food-category code. A nutrition panel is full of numbers with mass units. Accepted cost: a missed anchor now yields a "not found" advisory saying *rescan*, instead of a confident wrong value (P3, P4).
- `2026-09-10` **A `context_phrase_present` check may declare `requires_anchored_field`, which bars it from *failing* on a stage-C value.** A negative claim about printed wording needs the label to have been read well enough to support it. **This replaces the "tune the phrase list" idea, which was inspected and rejected:** a literal for one packet's garble overfits the pack to that packet, and a short fragment matches everything. **No fuzzy or edit-distance matching exists anywhere in the demo** — character-confusion repair is `T-2.1`, measured against the gold set, per `normalise.ts`'s own deferral.
- `2026-09-10` **Two of the four D-3 fixes make a check *harder* to fire, so each has a control test** asserting it still fires where the evidence does warrant it. A fix that only ever silences is indistinguishable from deleting the rule.
- `2026-09-10` **A synthetic fixture can pass on the strength of the bug it was meant to catch.** `COMPLETE_LABEL` claimed all six declarations and the suite agreed — the sixth came from `product` matching inside `Parle Products Pvt. Ltd.`, and no test asserted the value. Assert values, not just presence, or a fixture proves nothing.
- `2026-09-10` **Field-trial records' `extracted`/`verdict` blocks are never updated to match fixed code.** They are the log of what the device did at record time. Only the hand-written `expect` block is normative, and only it is read by the suite.

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
- **Anchor–value spatial association — still `T-2.3`, now partly guarded.** Stage B no
  longer pairs an anchor with a line printed *above* it (see **Now** item 2), which kills
  the measured false pairing without introducing a threshold. What remains is the real
  task: distance, column overlap and reading order, so record 002's `84.9 g` — 19 list
  indices from its anchor but right beside it on the label — is actually reached. Its
  `expect` block still says `null` and should be changed to `"84.9 g"` when `T-2.3` lands.
  Do not tune distance or column numbers against this one packet.
- `rulepack/CHANGELOG.md` is in the plan §18 layout ("every clause change, dated, with
  reviewer") but no task creates it. Fold it into `T-1.3`, which writes the first pack.
- **The `Record` control ships in the app.** `D-5` must decide whether the pitch shows a
  debug control. Removing it is one import and one element in `VerdictScreen.tsx`.
- **The frozen frame sometimes renders sideways.** With `skipProcessing` the EXIF
  orientation varies with how the phone was tilted at the shutter, so one capture displays
  upright and the next lies on its side. **The boxes are correct either way** — `<Image>`
  and ML Kit honour the same tag, so they never disagree with each other. Cosmetic only;
  fix in `D-5` polish, or drop `skipProcessing` in `D-3` and pay the rotate-and-rescale
  latency. Do not "fix" it by rotating the overlay — that reintroduces the bug D-2 removed.
- ~~`commodity_name` extracted `"may differ."`~~ / ~~`"s (6779%) (rice meal (44%),"`~~
  **RESOLVED** — the boundary-aware anchor match (Now item 1) closes the `cereal products`
  case, pinned by a regression test. One caveat kept deliberately: a line reading
  `product may differ` would match `product` as a *whole word* and still be taken, since
  the field's `anchor_remainder_is_value` gives it whatever follows. That is a lexicon
  question (is `product` too generic an anchor for `commodity_name`?), not a matching bug,
  and one packet does not settle it. Watch for it as packets 3–10 arrive.

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
