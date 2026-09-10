# Progress — SIH26034 Legal Metrology Compliance Checker

> Single source of truth for project state. Updated by `/handoff`, read by `/pickup`.
> Keep it terse. This file is read in full every session — every line costs tokens.

**Last updated:** 2026-09-10 · **Sessions completed:** 11 · **Current sprint:** 1 (paused for the demo detour)

---

## Now

> **DETOUR IN PROGRESS — demo app, phases `D-0`…`D-5` plus the accuracy track `A-0`…`A-4`.**
> See `docs/DEMO_PLAN.md` §4 for phase definitions, §2.1 for the OCR provider order.
> **When `D-5` ships, resume at `T-1.3`.** Demo code (`mobile/`) is throwaway scaffolding
> and must never be promoted into `packages/rule-engine-ts` or `rulepack/*.json`.
>
> **SCOPE REVISED TWICE 2026-09-10, and settled back on-device.** Accuracy was raised as
> the core feature, which briefly made server OCR the default and withdrew the offline
> claim. Working the options through reversed it: paid APIs need a card and there is no
> budget, and every free engine worth the swap must be self-hosted — which needs a laptop
> tethered to the phone, and the user ruled that out. **Final: ML Kit on-device, no server
> of any kind.** `DEMO_PLAN` §2.1 records every option considered and why it lost; do not
> re-derive it.
>
> **P2 is restored.** The device reaches a verdict alone, `NO_PROVIDER_REACHABLE` is
> dropped, beat 1 (aeroplane mode) is back, and `T-3.2`, `T-3.4` and `T-6.4` no longer
> need re-scoping. **The door is not closed:** "no laptop" rules out self-hosted engines,
> not a *cloud* host reached over mobile data. That stays an escalation if `A-0` ever shows
> ML Kit is not enough.
>
> **The accuracy work moved, it did not disappear** — to `C-0` (better images, and image
> upload), `A-0` (measure it) and `A-4` (spatial association, `T-2.3` pulled forward).
> All three are cheaper than swapping engines would have been, and `A-4` fixes the largest
> defect the field trial found, which was never an OCR failure.

**Current demo phase:** `A-0` — make accuracy measurable. **DONE.**
**Status:** all nine gates green (**131** TS tests, up from 104; 34 pytest). Nothing red.

**The plan's "Done when" has passed.** `DEMO_PLAN` §4 A-0 required *"the existing two
packets produce a per-provider table, ML Kit's column is populated from the records already
committed, and adding a provider needs no test changes."* All three hold: `npm test` prints
the table on every run, and nothing in `corpus.test.ts` names an engine — it iterates
`PROVIDERS` and each record's `readings`.

**What A-0 built, in four files.**

- `mobile/src/scan/provider.ts` (new) — the `OcrProvider` interface (`id`, `label`,
  `recognise`), plus `PROVIDERS`, the *descriptor* table the Node-side scorer reads, and
  `REFERENCE_PROVIDER_ID`. **Deliberately no registry of implementations**: the demo ships
  one engine and a candidate is scored by host replay, not by running on the phone. A map
  of one entry would look like a plan that does not exist.
- `mobile/src/camera/ocr.ts` — `mlKitProvider`, the first implementation. `capture.ts` and
  `useScanLoop.ts` now hold the interface, not the module, so the seam is real rather than
  decorative. `Capture` carries `provider`, and the recorder writes what actually ran.
- `mobile/src/scan/score.ts` (new) — the arithmetic, pure and separately tested
  (`score.test.ts`, on synthetic records so it does not move when the extractor does).
- `mobile/src/scan/corpus.test.ts` — **assertion and measurement are now separate.** The
  reference engine is asserted against `expect`; every other engine is measured and
  reported, never asserted. Otherwise adding an engine would be an act of breaking the
  suite, which is the friction A-0 exists to remove.

**Record schema bumped to `lmscan.field-trial/3`.** `lines` / `frame` / `timings.ocrMs`
became `readings[]`, each naming its engine — all three were per-*engine* facts wearing
per-*packet* clothing. Records 001/002 were rewritten in place as one `provider: "mlkit"`
reading; **verified byte-identical** on lines, boxes, timings, `extracted`, `verdict` and
`expect`. Same annotation-not-change precedent as `/2`. `recordedProvider` names the reading
the device took — the one `extracted`/`verdict` describe; every other reading is a host
replay and its timings are not device measurements (P8).

**The headline number is 100% precision and it means almost nothing — the report says so
itself.** The reference row *cannot* fall below 100% while the suite is green, because the
same `expect` blocks drive both it and the assertions, and they were written while reading
ML Kit's own output. It is a **regression indicator, not an accuracy score**, and it is
silent about declarations no reviewer named. This caveat is printed with the table and
pinned by a test, because it is exactly the line someone tidying the output would delete.

**Three more honesty rules are built into the scoring, not bolted on.**

1. *Precision decides* (P3) — with **no weighting constant**, which would be a number the
   method cannot support (P4). It is the first column and the sort key; recall is reported
   beside it and does not decide.
2. *Correctly withholding a value is `withheld`, never a hit.* Silence is not an output —
   counting it would let an engine that reads nothing score perfectly.
3. *Not measured is never zero.* An engine with no reading gets a row saying so, and
   `precision`/`recall` are `null`. Untried and failed are different claims (P9).

**A-0 could NOT answer the first question the plan set it.** `DEMO_PLAN` §4 A-0 asks *"how
much of the field trial's damage was the capture, not the engine? Re-photograph the same
packet properly, replay both, and compare"* — record 002's `INCL. OF ALL TAXES` read as
`NCL. OF 42L TAYES` is the cell to watch. **The corpus cannot make that comparison: both
records are `viewfinder`, and no packet has been recorded twice from two kinds of image.**
The harness is ready for it — the report now prints the capture mix and says in as many
words that a single-source corpus measures that capture kind and not the engine. Answering
it needs the Lays packet re-photographed with the stock camera and recorded as an `upload`.
That is `D-3` work and it needs the device. **Do not quote any A-0 number as ML Kit's
accuracy until that is done.**

**A real limit on the whole per-provider idea, found this session:** the JPEGs are
gitignored, so a candidate engine can only be replayed on a machine that still holds them.
Deleting the phone's `field-trial` directory forecloses scoring any future engine on those
packets. Recorded in `mobile/field-trial/README.md` next to the instructions.

**Not verified on the phone.** `A-0` is a *no device* phase and the change is JS-only;
typecheck, lint and 131 tests pass. The device-facing part is one line in the recorder — a
new record will be written as `/3` with a `readings` array. Worth one glance at the JSON the
next time a packet is recorded, which is `D-3`'s next action anyway.

**Next phase to actually start:** **`D-3`** — resume the field trial at 2/10. It is the only
thing that makes `A-0`'s table say anything, it is what `A-4`'s thresholds are waiting on,
and it must be finished before `D-5` regardless. After `D-3`: `D-4`, then `D-5`.

**`A-4` (done last session), in the lines that still matter.** Stage B pairs an anchor with
its value by geometry — right on the same row, or below in the same column — and refuses
when the geometry does not answer clearly (`mobile/src/scan/associate.ts`). Distances are in
multiples of the anchor's own text height, **never pixels**, which is what makes them
survive a change of camera distance; a test fails if anyone re-expresses one in pixels.
Every threshold is pack data (`demo-lmpc-v0.json` → `metadata.spatial_association`) and the
loader has no defaults. Two geometry lessons from record 002 that a synthetic fixture would
never have taught: **row membership is a centre-drift test, not an overlap test** (`NET QTY:`
and `84.9g` share only 24 px because the packet was photographed by hand), and **the reach
must be generous — the value was 2.6 anchor-heights away — with the *margin* doing the
refusing.** The thresholds are sized from typography and merely *checked* against two
captures of one packet: **that is not corpus tuning and must not be described as it** (P8).
They become real numbers when `D-3` has variety.

**`D-3` is paused at 2/10 by user decision, and is now the next thing to do.** It must be
resumed before `D-5`. **Judging a packet is not recording it** — packet 3 was uploaded and
judged three sessions ago but never recorded, so the corpus is still at 2. The remaining
work is 8 more packets *and* a hand-written `expect` block for each; **the `expect` blocks
are the slow half, not the photography.** **Variety, not count:** both current records are
the same product, so the pack is tuned to one label. Ten is a round number from the plan —
the real stopping rule is *when a new packet stops breaking something new*. Photograph the
remaining packets with the stock camera app, then feed each in with *Use a photo from the
gallery* and hit **Record**. `mobile/field-trial/README.md` has the flow, the `source` table
and (new) the `readings` shape.

**`C-0` is done and fully verified on the Nord 4** — full-quality still, image upload,
viewfinder demoted to framing feedback, nav-bar inset fixed on both screens (`NAV_BAR_INSET`
in `mobile/src/ui/layout.ts`, guarded by `layout.test.ts`). What it measured: same packet,
seconds apart, a `skipProcessing` viewfinder pass gave **32 lines and on a second pass 0**,
a full-quality capture gave **111** — 3.5× the text for about half a second more, ~1.6 s
shutter to verdict. ML Kit was never the binding constraint; the frame was. But that
111-line capture still located 2 of 6 declarations and **both were wrong**, while `150 g`,
`₹65.00` and `15JUL.2026` sat legibly in the frame, unfound. That was association, and `A-4`
addressed it.

**Driving the scan screen over ADB — read this before automating the phone again.**

- `uiautomator dump` **fails on the scan screen** with `ERROR: could not get idle state` —
  the live loop never lets the UI go idle. It works on the verdict screen and on the photo
  picker (both idle). On the scan screen, screenshot and compute coordinates instead.
- When the dump *does* work it is authoritative and worth the round trip: it gave
  `[239,2061][841,2162]` for the upload control against a screenshot estimate that was
  30 px off and cost several stray captures.
- **Send one tap, then look.** Batching `tap; sleep; tap` in a single command repeatedly
  produced the wrong thing — a tap meant for *Scan again* on the verdict screen also
  reached the newly mounted scan screen's controls, and later taps dismissed the picker
  before a screenshot could see it. The failure mode is *misrouting*, not only dropping.
- **The app restores a verdict on relaunch.** A fresh launch landing on a verdict screen is
  normal and is not evidence that a capture just ran.

**A second real packet's declarations panel is already in the gallery** — a tight, legible
shot with `NET QUANTITY 150 g`, `DATE OF MANUFACTURE 15JUL.2026`, `BATCH NO. 28085`,
`USE BY 14JAN.2027`, `₹65.00`, `(Inclusive of all taxes)`. It was uploaded and judged but
**deliberately not recorded** — recording reds the suite until a person writes its `expect`
block, which is the user's call. It is packet 3 of 10, it is ready to go, and it is the best
available first test of `A-4` on a packet the rule was not written against.

**All nine gates are green** (131 TS tests, 34 pytest). The next packet recorded will red
the suite until somebody writes its `expect` block — the mechanism working, not a breakage.

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

### What the first packet proved — the headline D-3 result

Both records are the *same compliant packet* (Lay's/PepsiCo bhujia namkeen), which has all
six declarations printed. **The app flagged it `ATTENTION` both times and every finding was
false** — the exact P3 failure the demo exists to prevent, found on the first real packet.
Four root causes, all now fixed; the rules they produced are in the decisions log
(`2026-09-10`, the seven entries from "Anchors match on a boundary" onward). In short: a bare
`indexOf` anchor match, Stage B pairing by list index with the boxes never read, shape-only
recovery of `net_quantity` off an FSSAI category code, and a phrase check calling wording
absent that OCR had merely garbled.

**Two of the four fixes only ever silence a finding**, so each carries a control test
asserting it still fires where the evidence warrants it. Seven regression tests in all, in
`extract.test.ts` and `evaluate.test.ts`, each naming the packet observation behind it —
they state the rules independently of the corpus, which `D-5` may prune.

Three things to carry forward:

- **The same packet gives a different verdict every pass** (record 001 found 2 fields, 002
  found 3, sharing none). P1 holds — the decision layer is pure — but its input is
  stochastic. State this in the pitch rather than letting it be discovered.
- **The evidence highlight is proven but its only demo instance is gone.** Tapping a
  finding draws the amber box over its source line on the frozen frame (D-2's open item,
  closed). The finding that proved it was `LMPC-6-1-MRP-INCLUSIVE` on record 002 — a
  *false* flag, which fix 4 removes. **Beat 5 now needs a real present-but-defective
  declaration**, or it has nothing to point at.
- **A synthetic fixture passed for two phases on the strength of the bug it should have
  caught.** `COMPLETE_LABEL` claimed six declarations and the suite agreed; the sixth came
  from `product` matching inside `Parle Products Pvt. Ltd.`, and no test asserted the
  value. Assert values, not just presence.

### Judgement calls in the `expect` blocks — overrule freely

Both records' `notes` fields carry the reasoning. The two that matter:

- ~~Record 002 `net_quantity` expects `null`~~ — **resolved by `A-4`**, it now expects
  `"84.9g"`. Kept here only so the next reader knows the corpus moved and why. The value
  is reached from its anchor 19 list-indices away because it is printed 2.6 anchor-heights
  to its right.
- Record 001 `commodity_name` expects `null`, though `namkeen` (line 8) is arguably the
  commodity name. Left null: P3 prefers silence, and one packet does not justify a new
  lexicon term.

The records' `extracted` and `verdict` blocks are **deliberately not updated** to match the
fixed code. They are a log of what the device did at record time — a measurement. The
`expect` block is the normative half, and it is the only half the suite reads.

### Device notes

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
name is `CPH2661`, not the adb serial.** Incremental Gradle is ~24 s; a new native module
costs ~2m 50s. JS edits reload over Metro with no rebuild.

**`expo run:android` launches the dev client at the LAN IP (`10.53.28.254:8081`), which the
phone cannot reach — Wi-Fi is off, it is on mobile data over USB.** It hangs on "Loading
from …" forever. `adb reverse tcp:8081 tcp:8081` is already set, so relaunch by hand at
localhost instead:
`adb shell am start -a android.intent.action.VIEW -d "exp+lm-scan-demo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`
First bundle after a native change takes ~3 min; `curl` the bundle once to force Metro to
build it, then launch, or the app sits on a white screen looking broken.

**Git Bash rewrites `/sdcard/...` into `C:/Program Files/Git/sdcard/...` for `adb push` and
`adb shell`.** Prefix those commands with `MSYS_NO_PATHCONV=1` or the file lands nowhere and
the error is misleading (it prints both a failure and "1 file pushed").

**The phone is the user's daily driver, and this check has now stopped a session twice.**
Check `adb shell dumpsys telephony.registry | grep mCallState` (0 = idle) before driving the
UI, and stop entirely if `dumpsys window | grep mCurrentFocus` shows an app the user opened.
A call came in mid-test during `C-0`; during `A-4` the user was in a game, so the on-device
look at the new verdict chip was skipped rather than taken. Skipping is the correct outcome
— say what was not seen, do not work around it.

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
- [>] `D-3` Field trial — 2/10 recorded; **paused by user decision, and now the next phase** — must be resumed before `D-5` ← **resume here**
- [x] `C-0` Capture quality — full-quality still, image upload, preview → viewfinder · **fully verified on device**
- [x] `A-4` Spatial anchor-value association (`T-2.3` pulled forward) · *no device* — acceptance test passed; thresholds not yet corpus-tuned
- [x] `A-0` Make accuracy measurable — `OCRProvider`, per-provider corpus · *no device* — table prints; **cannot yet separate capture from engine (needs a second-source record, see Parked)**
- [ ] `D-4` Honest degradation **+ frame admission** — refuse a bad frame before OCR runs (`T-2.7` half pulled forward)
- [~] `A-1`/`A-2`/`A-3` Server OCR — **dropped**, see `DEMO_PLAN` §2.1
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
- ~~A Cloud Vision key~~, ~~Docker~~, ~~a GPU~~, ~~the phone's wifi~~ — **all dropped as
  blockers** when the engine settled on ML Kit. Docker is still wanted eventually for
  `T-1.11`, but it is off the critical path.
- **Keep the Nord 4 connected.** `D-3`…`D-5` all need it. Device name `CPH2661`,
  serial `bac3856a`, camera permission already granted to `com.sih26034.lmscan`.
- **Packet 3 (Bhujialalji Navratna Mix) is photographed, framed well and already in the
  gallery** — see **Now**. It has been uploaded and judged but not recorded, because a
  record reds the suite until a person writes its `expect` block. **Decide whether to record
  it**; nothing else is needed to. **This is now the cheapest test of `A-4` against a packet
  the rule was not written on** — its panel reads `NET QUANTITY 150 g` and `₹65.00`, so it
  will exercise the association path immediately.
- **Eight more packets for `D-3`, and this is now cheap.** Photograph them with the stock
  camera app 15–20 cm from the panel, then feed each in via the gallery and hit Record.
  LMPC covers *any* packaged commodity — toothpaste, soap, shampoo, tea, salt, atta, oil,
  biscuits, noodles, a medicine box all qualify. **Variety is the point**, since the wording
  varies (`Net Wt.`/`Net Qty`/`Quantity`, g/ml/kg/L, MRP phrasings, one- vs two-column
  panels). Ten captures of one packet would tune the pack to that packet.
- **Re-photograph the Lays packet (records 001/002) with the stock camera and record it as
  an `upload`.** One packet, one photo, one `expect` block. It is the only thing standing
  between `A-0`'s table and the question `A-0` was set: *was the field trial's damage the
  capture or the engine?* Worth doing first among the eight, because it also answers whether
  a cloud engine ever needs to be considered again.
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
- `2026-09-10` **The live preview never produces a verdict.** It is a viewfinder — fast, `skipProcessing`, framing feedback only. A verdict rests on a deliberate full-quality capture or an uploaded photo. Enforced by the type system, not convention: `LiveCapture` is `source: 'viewfinder'`, which `JudgedCapture` excludes.
- `2026-09-10` Every capture declares a `source` (`viewfinder` / `still` / `upload`) and it is written into the field-trial record. The three are different measurements of a label and a corpus that mixes them silently cannot be compared (P8).
- `2026-09-10` `timings.captureMs` is `null` for an upload, never `0` — there is no shutter this app timed (P4). Record schema bumped to `lmscan.field-trial/2`; records 001/002 were annotated `"source": "viewfinder"` in place, no line/box/timing touched, so the corpus carries exactly one schema.
- `2026-09-10` Anything that wants the camera goes through `useScanLoop`'s `exclusive()`, which suspends the loop and awaits the pass in flight. "One capture in flight at a time" now holds for the whole app, not just the loop.
- `2026-09-10` **`A-0`: a field-trial record holds `readings[]`, one per OCR engine, not a single `lines` array.** `ocrMs` and `frame` moved inside the reading because both are per-engine facts. Schema `lmscan.field-trial/3`; 001/002 rewritten in place as one `mlkit` reading, verified byte-identical. `recordedProvider` names the reading the device took.
- `2026-09-10` **The reference OCR provider is asserted; every other provider is measured, never asserted.** A candidate engine disagreeing with a reviewer's `expect` block is a number for the table, not a red build — otherwise adding an engine means breaking the suite.
- `2026-09-10` **No weighting constant for P3.** "A false flag costs more than a miss" is expressed as *precision is the headline and the sort key*, with recall reported beside it and not deciding. A tuned cost ratio would be a number the method cannot support (P4).
- `2026-09-10` **Correctly withholding a value is `withheld`, never scored as a hit**, and **a provider with no reading is `not measured`, never zero** (`precision`/`recall` are `null`). Untried and failed are different claims.
- `2026-09-10` **No registry of OCR *implementations*.** `PROVIDERS` is descriptors only (id, label, note); `mlKitProvider` is a plain value in `camera/ocr.ts`. The demo ships one engine and scores candidates by host replay — a one-entry map would imply a plan that does not exist.
- `2026-09-10` `expo-image-picker` is installed but **deliberately not listed in `app.json` plugins**. Its Android half only adds `RECORD_AUDIO` and crop-tool colours; `launchImageLibraryAsync` uses the Android photo picker and needs no runtime permission. Registering it would make the app request a microphone it never uses.
- `2026-09-10` Beat 3 is no longer "verdict in under a second". Capture→verdict is ~1.6 s measured, and the demo says so. What survives is the claim that mattered: the image on screen is exactly the image the verdict was read from.
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
- `2026-09-10` **USER DECISION (final, after two reversals) — the OCR engine stays ML Kit, on-device, with no server of any kind.** Accuracy was raised as the core feature and server OCR was briefly made the default; the constraint that settled it was *"we are not using anything that requires the phone to be connected to a laptop continuously."* Paid APIs were already out for lack of budget, and every free engine worth swapping to must be self-hosted. **P2 is therefore restored**, `NO_PROVIDER_REACHABLE` is dropped, beat 1 (aeroplane mode) is back, and `T-3.2`/`T-3.4`/`T-6.4` need no re-scope. **The door is not closed:** "no laptop" rules out self-hosted engines, not a *cloud* host reached over mobile data — that stays an escalation if `A-0` ever shows ML Kit is insufficient.
- `2026-09-10` **`D-4` expanded to include frame admission** (`T-2.7` half pulled forward, plan §6.2/§11.3): score blur, glare and text coverage, and refuse to run OCR at all on a frame that fails. Refusing a bad frame prevents a wrong verdict at the source rather than catching it after. Thresholds are pack data beside `evidence_thresholds`, not code (P6). Includes freezing on the **best of the last few frames** rather than the last one — free once a frame can be scored. This is layer 1 of four; layers 2–4 already work.
- `2026-09-10` **"No wrong verdict" is not achievable and must not be claimed.** If OCR reads `84.9g` as `8.9g` the value is plausible and well-formed, and nothing downstream can know. What is achievable is **no *unchecked* wrong verdict**: never claim compliance, never emit a violation, refuse rather than guess, and show the officer the pixels behind every finding so they can overrule it (P3, P7, P9). Say this in the pitch rather than letting a judge find it.
- `2026-09-10` **Deliberately NOT pulled back from the cut list**, with reasons, so this is not re-argued: Rule 7 height and Rule 8(2) parity (violates P4 — no millimetre figure without a scale reference); applicability gates `T-1.5` (real P5 win, but the exemption thresholds are unverified, so it would mean adding guessed law); barcode/GS1 `T-2.6` (good beat, does not help locate declarations); Python evaluator and conformance (no demo value); backend, dashboard, e-commerce (no demo value, weeks of work). `T-3.8` "This looks wrong" is the one genuine maybe — revisit only after `A-4` lands.
- `2026-09-10` **With the engine fixed, accuracy comes from three cheaper levers**, in order: `C-0` better images, `A-4` better extraction, `T-2.7` refusing bad frames and coaching the officer. `A-4` is the largest — the biggest defect the field trial found was `84.9g` read *correctly* and associated with the wrong anchor.
- `2026-09-10` **Cloud Vision rejected — no budget.** It needs a billing account with a card even inside its ~1,000 images/month free tier. PaddleOCR is Apache-2.0, free, no card, no account, no quota, **no Docker** (`pip install` is enough), and returns per-line boxes. Free escalation ladder before anything is ever paid for: RapidOCR → Surya → docTR → only then Cloud Vision, and even then via the $300 trial credit or SIH sponsor credits. **Do not re-derive this ladder.**
- `2026-09-10` **Rejected: OCR.space** — free tier caps uploads near 1 MB against 3.6 MB captures, and downscaling that hard destroys the 1–2 mm print the tool exists to read. **Rejected: a VLM doing the extraction** (Gemini free tier, GOT-OCR2, dots.ocr, olmOCR) — it would read better and would delete the differentiator, since P1 requires a pure decision function and P6 requires rules to be data; their bounding boxes are also approximate, which breaks P7 and starves `A-4`.
- `2026-09-10` **Rejected: on-device PaddleOCR.** PP-OCR mobile models are ~15 MB and built for phones, but there is no maintained React Native binding, so the route is ONNX Runtime Mobile with hand-written tensor pre/post-processing — days of work, a full Gradle rebuild, 15–30 MB of APK — and the mobile models are markedly weaker than the server models, costing the accuracy the change exists to buy. **ML Kit remains the best on-device option available.** Revisit only if the no-signal case becomes a requirement; it is the one route that would restore P2.
- `2026-09-10` **PaddleOCR, RapidOCR, docTR rejected — all self-hosted, all need a tethered laptop.** Free and accurate (PaddleOCR's server models close most of the ML-Kit-to-Cloud-Vision gap on printed panel text), and none of that survives the no-laptop constraint. Recorded so the option is not re-costed: `pip install paddlepaddle paddleocr fastapi uvicorn`, phone reaches it by `adb reverse tcp:8000 tcp:8000` or laptop hotspot. This is the shape a *cloud*-hosted escalation would take.
- `2026-09-10` **Surya assessed and rejected.** Strong on document benchmarks and returns real boxes, but it is tuned on scanned pages while these are photographs of crinkled foil, so the benchmark advantage may not transfer; and its transformer recogniser is slow on CPU where PaddleOCR's CNN recogniser is fast. Kept as an `A-0` column, not a starting point.
- `2026-09-10` **The `/ocr` endpoint URL is configuration, not code.** The laptop is a stand-in for a cloud host, so the same build must point at either without a rebuild. Dev reaches it by `adb reverse tcp:8000 tcp:8000` over the existing cable (no wifi); the demo uses the laptop's hotspot (the phone's wifi is off and must be turned on); real deployment uses mobile data to a cloud host.
- `2026-09-10` **Better OCR fixes one of the four defects the field trial measured, not four.** Of the four: one was a recognition failure (`INCL. OF ALL TAXES` → `NCL. OF 42L TAYES`); three were our own logic. The largest — `net_quantity` reporting `15.1g` when the true `84.9g` **had been read correctly** — is anchor-value association, which no OCR upgrade touches. `T-2.3` is therefore pulled forward as `A-4`, and shipping a provider integration without it buys a sharper camera pointed at the wrong line.
- `2026-09-10` **`A-0` precedes every provider integration.** An accuracy claim with no per-provider measurement over recorded packets is a vendor claim, and P8 bars quoting a figure that was not measured. The field-trial JPEGs stop being keepsakes and become the input that lets a new engine be scored against packets already collected.
- `2026-09-10` **The Cloud Vision key lives on a server, never in the APK.** A key shipped in a React Native bundle is extractable by anyone with the file. This is the only reason the demo gains a backend; the `/ocr` endpoint is stateless, with no Postgres and no auth beyond a shared secret.
- `2026-09-10` **`skipProcessing: true` is right for a preview frame and wrong for a judged one.** It skips autofocus settle, HDR and multi-frame noise reduction — exactly what makes 1–2 mm print legible — and leaves EXIF orientation varying, which is the cause of the parked "frozen frame renders sideways" bug. `C-0` drops it on the judged capture. JS-only, no rebuild, free.
- `2026-09-10` **Live preview is a viewfinder, not a verdict source.** It keeps its tracking boxes (beat 2 depends on them) and its job becomes framing feedback, which is where `T-2.7`'s coach hints will live. The judged frame comes from a full-quality capture or an uploaded photo.
- `2026-09-10` **Image upload is how `D-3` gets unblocked.** Ten packets photographed with the stock camera app in five minutes beats ten held in front of a live scan. The field-trial recorder must accept an uploaded image exactly as it accepts a frozen frame. It is also `T-2.8`'s 400-image gold-set entry point, built early rather than extra.
- `2026-09-10` **Field-trial records' `extracted`/`verdict` blocks are never updated to match fixed code.** They are the log of what the device did at record time. Only the hand-written `expect` block is normative, and only it is read by the suite.
- `2026-09-10` **`C-0` is fully closed — the upload path is verified on the Nord 4.** Stats line read `uploaded photo · capture n/a · 20 lines · OCR 692 ms`. `capture n/a` rather than `0` confirms the `captureMs: null` decision (P4) survives to the screen, not just the type.
- `2026-09-10` **The upload control was untappable, and that is why it was never verified.** `ScanScreen`'s bottom-anchored `controls` used a bare `bottom: 36` with no navigation-bar inset, so on the Nord 4 (density 480, 144 px three-button bar) the gallery Pressable's lower third lay inside the bar's touch region and a tap on it reached HOME. Not a test-harness artefact — a finger would have done the same.
- `2026-09-10` **`NAV_BAR_INSET` moved to `mobile/src/ui/layout.ts` and both screens import it.** It was declared privately inside `VerdictScreen`, which is exactly how `ScanScreen` came to be missed. A shared chrome constant is the structural fix; `src/ui/` is the home for screen chrome, since `src/scan/` is the extraction domain layer and this is not domain.
- `2026-09-10` **`mobile/src/ui/layout.test.ts` fails the build if any `bottom:` offset under `mobile/src` omits `NAV_BAR_INSET`** (bare `bottom: 0` is allowed as a deliberate flush edge). Confirmed to fail on the pre-fix value before being kept — a guard that cannot fail is not a guard.
- `2026-09-10` **`uiautomator dump` cannot read the scan screen** (`ERROR: could not get idle state`) — the live loop keeps the UI perpetually non-idle. It works on the verdict screen and the photo picker. Screenshot-and-compute is the only option on the scan screen, and it is worth reaching for a dump wherever the UI does settle: the dump's bounds beat a screenshot estimate that was 30 px off.
- `2026-09-10` **Drive the phone one tap at a time, then look.** The recorded hazard was taps being *dropped*; this session showed they are also *misrouted* — a single tap aimed at *Scan again* also reached the freshly mounted scan screen's controls, and batched follow-up taps dismissed the photo picker before any screenshot saw it. Never batch `tap; sleep; tap` in one command.
- `2026-09-10` **USER DECISION — `D-3` paused at 2/10 and `A-4` taken next.** Not a cut: `D-3` stays `[>]` and must be finished before `D-5`. Rationale: the remaining packets would re-demonstrate one already-understood defect, and each costs an `expect` block asserting known-wrong behaviour. Fix association first, then collect. Also settled, so it is not re-argued: **`D-3` wants variety, not ten** — both current records are the same product, "ten packets" is a round number the plan never derives, and the real stopping rule is *when a new packet stops finding a new failure*.
- `2026-09-10` **The app restores a judged verdict on relaunch.** A cold launch landing on the verdict screen is normal; it is not evidence that a capture just ran, and it misled this session for several rounds.
- `2026-09-10` **`A-4` landed. Stage B pairs by geometry, not by OCR list index.** Two directional neighbourhoods (right-of-anchor on the same row; below-anchor in the same column), scored on proximity plus value-shape strength, with a floor and a runner-up margin. `mobile/src/scan/associate.ts`. Acceptance test from `DEMO_PLAN` §4 A-4 passed.
- `2026-09-10` **Row membership is a centre-drift test, not a box-overlap test.** Settled by measurement, not preference: on record 002 the correct anchor/value pair overlaps vertically by 24 px out of 123, because the packet was photographed by hand. An overlap test rejects the right answer; the drift between row centres (0.99 anchor-heights) accepts it. Do not "tighten" this back to an overlap test.
- `2026-09-10` **Every association distance is in multiples of the anchor's own text height, never pixels.** This is what makes the thresholds independent of camera distance and phone. Guarded by a scale-invariance test in `extract.test.ts`; re-expressing any of them in pixels fails the build.
- `2026-09-10` **A near-tie produces nothing, not a coin flip.** The winning candidate must clear an absolute floor *and* beat the runner-up by a margin, both pack data. Silence is an advisory saying "rescan"; a guess is a confident falsehood about what is printed (P3). Tested both ways — the refusal and the control that still answers.
- `2026-09-10` **The pre-`A-4` list-order pairing is kept as the degraded path, not deleted.** It runs only when the engine gave the anchor line no bounding box. The extracted value's `association` is null in that case, which is how a reader tells the two apart (P9).
- `2026-09-10` **`value_may_span_lines` kept its meaning and changed its unit.** It is still the per-field downward reach, but measured in label geometry (`× row_pitch_heights`) rather than in OCR list entries. No pack field was renamed or removed.
- `2026-09-10` **Record 002 expects `84.9g`, not `84.9 g` as the plan's acceptance line writes it.** The OCR line has no space. A record states what the label was read to say, not a tidied version (P4).
- `2026-09-10` **The association thresholds are NOT corpus-tuned and may not be described as such.** Sized from typography, then checked against two captures of one packet. `DEMO_PLAN` §4 A-4's "chosen against the field-trial corpus" is the one line of that phase still unsatisfiable, and it stays unsatisfiable until `D-3` has variety (P8).
- `2026-09-10` **`T-2.3` stays open on the Sprint-2 board.** `A-4` is the demo-scale version in `mobile/` only. The real task is both runtimes, conformance fixtures and gold-set tuning, and shipping the demo version does not close it.

---

## Open questions

- [ ] **LMPC sub-clause letters unverified.** v1: MRP 6(1)(f), date 6(1)(g). Common reading: MRP 6(1)(e), date 6(1)(d). Everything legal stays `PENDING_LEGAL_REVIEW` until confirmed. *(plan §2.2, §4.2)*
- [ ] Rule 7 height table values are a plausible reconstruction, not verified against the Second Schedule. *(plan §4.3)*
- [ ] Small-quantity exemption thresholds (10 g / 10 ml and carve-outs) unverified. *(plan §4.1)*
- [ ] Best-before attribution — likely FSSAI Labelling & Display Regs 2020, not LMPC. *(plan §2.2)*
- [x] ~~Does the SIH26034 problem statement call for offline operation?~~ User checked
  2026-09-10: it does not appear to. Moot in any case — the app is fully offline again.

---

## Parked

Noticed but deliberately out of scope for now. Do not action without asking.

- **The A-0 table cannot yet separate the capture from the engine.** Both records are
  `viewfinder`, so the plan's first question for A-0 — *was the field trial's damage the
  capture or the engine?* — is unanswerable from the corpus. It needs the **Lays** packet
  (records 001/002) re-photographed with the stock camera and recorded as an `upload`, then
  the two rows compared; watch record 002's `MIRP RS. 20/- (NCL. OF 42L TAYES)`. One packet,
  one photo, one `expect` block — do it as part of `D-3`.

- **The field-trial JPEGs are gitignored, and that forecloses future scoring.** A candidate
  OCR engine can only be replayed on a machine that still holds the images. Do not clear the
  phone's `field-trial` directory or the local `mobile/field-trial/*.jpg` without deciding
  that no other engine will ever be scored on those packets. Not proposing to commit them —
  ten full-resolution captures in a repo with no remote is why they are ignored — but the
  trade is now explicit.

- **`extracted` and `verdict` in a record still describe only the device's reading.** A host
  replay appends `readings` but writes no per-reading extraction, so the descriptive half of
  a record is single-engine while the measured half is not. `corpus.test.ts` recomputes both
  for every reading, so nothing is lost — but a person reading the raw JSON of a two-engine
  record will see one `extracted` block and may take it for both. Revisit when a second
  engine actually has readings.

- **No screen chrome is exercised on a device by any test.** `layout.test.ts` now guards the
  one constant that bit us, but it reads source text — it cannot know that a control is
  reachable by a finger. The upload button shipped, built, bundled and autolinked, and was
  still unusable. Anything bottom- or edge-anchored added from here needs one real tap on
  the Nord 4 before it is called done.

- **The verdict chip's new association text has not been seen on a device.**
  `net_quantity · B_anchored_adjacent · medium · right 2.62×` renders in
  `VerdictScreen.tsx`'s `FieldChip`, which is a one-line `numberOfLines={1}` `Text`. On a
  narrow chip the tail may simply be clipped. Cosmetic, nothing depends on it — look next
  time the phone is free and the user is not on it.

- **Stage B still takes the first anchor that yields a value, scanning top to bottom.**
  Within one anchor, competing candidates are now resolved properly; between two anchors for
  the same field on one label (a promotional pack with two `MRP`s) the upper one still wins
  by position alone. Not wrong, not principled either. Revisit if a real packet shows it.

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
- `rulepack/CHANGELOG.md` is in the plan §18 layout ("every clause change, dated, with
  reviewer") but no task creates it. Fold it into `T-1.3`, which writes the first pack.
- **The `Record` control ships in the app.** `D-5` must decide whether the pitch shows a
  debug control. Removing it is one import and one element in `VerdictScreen.tsx`.
- ~~**The frozen frame sometimes renders sideways.**~~ **RESOLVED by `C-0`** — the judged
  image is now a processed still or an uploaded photo, both of which have settled EXIF, so
  the orientation no longer varies. Verified upright on the device.
- **`mobile/` has 10 moderate npm advisories; the root has 0.** All ten are one `uuid`
  advisory reaching `@expo/config-plugins` through `xcode` — Expo's iOS project writer,
  which this Android-only app never runs, and dev-time only. Pre-dates `C-0`; the picker
  added none. The `npm audit` gate runs at the root and is green. Leave it unless Expo
  ships a fix; do not `audit fix --force` a working native toolchain before a demo.
- **The viewfinder can report 0 lines on a well-framed panel.** Measured this session: the
  panel filled the frame and the `skipProcessing` preview frame was too blurry to read.
  Harmless now that the viewfinder no longer judges, but it is the exact case `D-4`'s frame
  admission must catch, and the coach hint should say "hold still" rather than "get closer".
- ~~`commodity_name` extracted `"may differ."`~~ / ~~`"s (6779%) (rice meal (44%),"`~~
  **RESOLVED** — the boundary-aware anchor match (Now item 1) closes the `cereal products`
  case, pinned by a regression test. One caveat kept deliberately: a line reading
  `product may differ` would match `product` as a *whole word* and still be taken, since
  the field's `anchor_remainder_is_value` gives it whatever follows. That is a lexicon
  question (is `product` too generic an anchor for `commodity_name`?), not a matching bug,
  and one packet does not settle it. **It has now been seen: packet 3 extracted
  `commodity_name: "nmay differ."` from "actual product may differ", twice, on two separate
  frames. That is two packets, not one — but it is still a lexicon question (is `product`
  too generic an anchor for `commodity_name`?) and it belongs to `A-4`/the lexicon pass, not
  to a matching fix. Do not patch it in isolation.**

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
- [>] `T-2.3` Cascade Stage B — anchor–value spatial association · *plan §7.2* **(highest-value task in the project)** — **demo-scale version shipped as `A-4`** in `mobile/`; the Sprint-2 task is the real one (both runtimes, conformance fixtures, gold-set tuning) and stays open
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
- [>] `T-3.3` OCR adapters behind `OCRProvider` — Cloud Vision + PaddleOCR · *plan §5.1, §17* — **the interface landed as demo phase `A-0`** (`mobile/src/scan/provider.ts`, demo-scale, `mobile/` only); the adapters themselves are rejected for the demo, see `DEMO_PLAN` §2.1. The Sprint-3 task is the real one (both runtimes, server adapters) and stays open
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
