# Demo Plan — core loop, then accuracy

> **Status:** active detour. Not a replacement for `docs/IMPLEMENTATION_PLAN_v2.pdf`.
> When the demo ships, the board resumes at **`T-1.3`** exactly where it was.
>
> **Created:** 2026-09-10 · **Target device:** OnePlus Nord 4 (physical, USB)
>
> **Revised 2026-09-10.** Accuracy was raised as the core feature. After working through
> the options (§2.1) the engine stays **ML Kit on-device** — no server, no laptop, no key,
> no budget — and the accuracy work becomes `C-0` (better images, and image upload),
> `A-0` (measure it) and `A-4` (spatial association, `T-2.3` pulled forward). **P2 is
> restored** and the demo runs in aeroplane mode again. Still not a one-day plan: `A-4`
> is real work pulled forward from Sprint 2.

---

## 1. What the demo is

One Android app, installed on the user's own phone, that does this and nothing else:

> Point the phone at a packaged product label. Text is recognised live on the preview.
> Tap **Freeze** and the app names which mandatory declarations under the Legal Metrology
> (Packaged Commodities) Rules, 2011 it found, which it did not, and cites the clause for
> each — with the image region a human can look at to agree or disagree. In aeroplane mode.

That is the whole pitch. Everything below serves it or is cut.

**Revised twice on 2026-09-10, and back where it started.** Accuracy was raised as the core
feature, which briefly made server OCR the default and withdrew the offline claim. Working
through it reversed that: paid APIs need a card and there is no budget, and every free
engine good enough to be worth the swap must be self-hosted, which needs a laptop tethered
to the phone. The user ruled that out. So the engine stays ML Kit, **P2 is restored**, and
the accuracy work moves to where it was always cheaper anyway — better images (`C-0`),
better extraction (`A-4`) and frame coaching (`T-2.7`). §2.1 records every option that was
considered and why it lost, so none of it is re-derived.

### The five beats of the live demo

| # | Beat | What the judge sees | Principle it proves |
|---|---|---|---|
| 1 | Aeroplane mode is on before the app opens | No network the entire demo | **P2** offline first |
| 2 | Live preview, text boxes tracking the label | It is reading, not guessing | — |
| 3 | Capture → verdict | Six declarations, found/missing | — |
| 4 | Every finding names statute, rule, sub-clause, pack version | Not a vibe, a citation | **P1** deterministic, **P6** rules are data |
| 5 | Tap a finding → the exact crop it came from | A person can overrule the machine | **P7** evidence is for a human |

**Beat 3 changed in `C-0`, and the demo must not oversell it.** It used to read "Freeze →
verdict in under a second", which was true because Freeze judged a preview frame already
recognised — nothing was left to do but `extract` and `evaluate`, both pure and
sub-millisecond. `C-0` traded that instant for a frame worth judging: **Capture** now takes
a full-quality still and runs OCR on it, so there is a real wait, and the screen shows a
spinner naming what it is doing. **Measured on the Nord 4: 785 ms capture + 842 ms OCR +
14 ms extract and evaluate — about 1.6 s, shutter to verdict.** Say that, offline, rather
than implying an instant one. The claim that survives intact is the one that mattered: the
image on screen is exactly the image the verdict was read from.

### The sixth beat, if asked "is it ever wrong?"

Show an unreadable / partial capture. The app says **`INSUFFICIENT EVIDENCE`**, not
`COMPLIANT`. Every finding is badged `advisory`, never `violation`, because the demo
rule pack is `PENDING_LEGAL_REVIEW`. That is **P3** and **P9**, and it is a stronger
answer than a perfect scan.

---

## 2. Scope

### In — core features

1. **Live camera + on-device OCR through a provider interface** (English / Latin script,
   ML Kit). The interface exists so a different engine can be measured later without
   touching `extract` or `evaluate` — not because one is planned. §2.1.
2. **Two ways in: capture or upload.** A full-quality still from the camera, or a photo
   picked from the gallery. Both feed the identical pipeline; the live preview is a
   viewfinder and never produces a verdict on its own (`C-0`).
3. **Extraction** of six Rule 6 universal declarations from the OCR line set:
   - common / generic name of the commodity
   - net quantity with unit
   - retail sale price (MRP)
   - month & year of manufacture / packing
   - name & address of the manufacturer / packer / importer
   - consumer care contact (phone or email)
4. **Deterministic evaluator** — a pure function `(fields, rulepack) → verdict`. No
   learned parameters, no network, no clock-dependent behaviour.
5. **Demo rule pack** — the six declarations as JSON data with clause ids,
   `alternate_readings` for the contested sub-clause letters, and provenance status.
6. **Verdict screen** — overall status, per-finding citation, evidence crop.
7. **Visible degradation** — coverage / confidence banner; `INSUFFICIENT EVIDENCE`
   when the OCR line set is too thin to conclude anything.
8. **A measured accuracy figure** — recorded packets replayed through the pipeline, so
   any accuracy claim is a number from `field-trial/`, not an assertion (**P8**).
9. **Fully offline.** The app makes zero network calls. Verified in aeroplane mode.

### Out — deliberately cut for the demo

Each of these has a task on the real board. None is deleted, all are deferred.

| Cut | Why | Returns at |
|---|---|---|
| Backend, Postgres, sync, dashboard | Nothing in the beats needs a server. Briefly reversed on 2026-09-10 and reversed back — see §2.1 | `T-1.10`, Sprint 4 |
| Python evaluator + conformance suite | One evaluator cannot diverge from itself | `T-1.8`, `T-1.9` |
| Hindi / Devanagari OCR and UI | Devanagari model is weak on real labels; a visible miss costs more than the feature earns | `T-2.5`, `T-5.5` |
| Any millimetre measurement, Rule 7 height, Rule 8(2) parity | **P4** — no number without a stated scale reference, and the demo has none | `T-1.4`, `T-3.7`, `T-5.7` |
| Barcode / GS1 identity | Cheap but not one of the five beats | `T-2.6`, `T-4.1` |
| Scan history, PDF export, corrections loop | Not in the five beats | `T-3.8`, `T-4.8`, `T-5.4` |
| Applicability gates (exempt packs, small quantity) | **P5** matters, but the thresholds are unverified and gates are `T-1.5` | `T-1.5` |
| E-commerce sweep | Whole separate surface | Sprint 5 |

### 2.1 OCR: ML Kit on-device, and why nothing else

Decided by the user on 2026-09-10, after two revisions as the cost and hosting of each
option were worked through. **Final: ML Kit on the phone. No server of any kind.**

The constraint that settled it: *"we are not using anything that requires the phone to be
connected to a laptop continuously."* That rules out every self-hosted engine, and paid
APIs were already ruled out by having no budget. What remains is on-device, and on-device
means ML Kit.

| Engine | Where | Verdict |
|---|---|---|
| **ML Kit** | On the phone | **In use.** Free, fast (825 ms measured), already integrated, returns lines with boxes |
| PaddleOCR / Surya / docTR / RapidOCR | A laptop you host | **Rejected** — requires a machine tethered to the phone |
| Cloud Vision, OCR.space | Someone else's server | **Rejected** — Cloud Vision needs a card and there is no budget; OCR.space caps free uploads near 1 MB against 3.6 MB captures, which destroys the 1–2 mm print |
| PP-OCR mobile via ONNX | On the phone | **Rejected** — no maintained React Native binding, days of native work, 15–30 MB of APK, and the mobile models are markedly weaker than the server ones |
| Any VLM doing extraction | Anywhere | **Rejected** — reads better, deletes the differentiator (**P1**, **P6**), and approximate boxes break **P7** and starve `A-4` |

**P2 is restored.** The earlier decision to refuse a verdict with no server is moot — there
is no server. The device reaches a verdict alone, `NO_PROVIDER_REACHABLE` is dropped, and
**beat 1 (aeroplane mode) is back**. `T-3.2`, `T-3.4` and `T-6.4` no longer need re-scoping.

**The door is not closed.** "No laptop" rules out *self-hosted* engines, not server OCR in
principle: a **cloud** host needs no laptop, and the phone would reach it over mobile data.
If accuracy ever proves insufficient, that is the escalation — a cloud-hosted PaddleOCR
first (free software, cheap host), then Cloud Vision via its $300 trial credit or SIH
sponsor credits. `A-0` exists so that decision is made on numbers.

**Where the remaining accuracy comes from.** With the engine fixed, three levers are left,
and they are all cheaper than swapping engines would have been:

1. **`C-0` — better images.** Every capture measured so far has been a `skipProcessing`
   live frame, the worst input the app can produce. **ML Kit has never been handed a proper
   photo.** Fixing that costs nothing.
2. **`A-4` — better extraction.** The largest defect the field trial found was
   `net_quantity` reporting `15.1g` when the true `84.9g` **had been read correctly**. That
   was never an OCR problem; it is anchor-value association, `T-2.3`, and it is now the
   single biggest accuracy win available.
3. **`T-2.7` — refusing bad frames and coaching the officer.** Glare and framing are fixed
   by moving the phone, not by a better model.

### Not negotiable even in a demo

These survive the cut because dropping them would make the demo dishonest:

- No statutory value hard-coded in `.ts`. The demo pack is data, loaded at runtime. (**P6**)
- Nothing marked `PENDING_LEGAL_REVIEW` may render as `violation`. (**P3**, working agreements)
- Contested sub-clause letters carry both readings. No silent pick. (open question, §2.2)
- Every finding carries a crop reference. (**P7**)
- Latency numbers, if quoted at all, come from the Nord 4. (**P8**)
- **Accuracy numbers, if quoted at all, come from `field-trial/`** — replayed over real
  recorded packets, never estimated, never taken from a vendor's marketing page. (**P8**)
- The app says which engine read the label. A degraded read never renders as a clean
  one. (**P9**)

---

## 3. Technical route and its fallbacks

The single biggest risk in the day is the first native Android build. Everything here
is arranged so that risk is paid **once**, early, and cannot recur.

### Decision: one native build contains every candidate library

All camera/OCR dependencies for the primary route *and* both fallbacks are installed
before the first `expo run:android`. Switching routes afterwards is a JavaScript-only
change — no Gradle, no reinstall, no lost hour.

```
expo-dev-client
expo-camera                           ← preview + throttled still capture
@react-native-ml-kit/text-recognition ← the OCR call, shared by all routes
```

### Routes, in order of preference

| Route | Mechanism | Frame rate | Risk |
|---|---|---|---|
| **A (primary)** | `expo-camera` preview + `takePictureAsync({ skipProcessing: true })` in a throttled loop → ML Kit | ~2–4 /s | Very low. Both libs are version-matched by `expo install`; no worklets, no plugin, no third-party camera native code. |
| **B (fallback)** | Same loop, OCR swapped to `@infinitered/react-native-mlkit-text-recognition` | ~2–4 /s | Low. Only fires if the ML Kit binding fails to build. |
| **C (floor)** | Single tap-to-capture still → ML Kit | n/a | Cannot fail. Visually near-identical to a judge. |

**Why not VisionCamera.** It was the first choice — its snapshot API would have given
5–8 fps. As of v5.2.3 it requires the `react-native-nitro-modules` / `react-native-nitro-image`
stack and its fast snapshot path is gone, so the live route would have to go through
Nitro worklets and a frame-processor plugin. That is precisely the multi-hour
version-alignment rabbit hole this plan exists to avoid, and it buys a frame rate no
judge can distinguish. Three fewer native dependencies also means a materially faster
first Gradle build. Frame processors belong to `T-1.12`, where there is time to do them
properly.

Perceived smoothness at 2–4 fps comes from interpolating the overlay boxes between OCR
results, not from the OCR rate itself.

The OCR call sits behind one interface so all three routes feed the same pipeline:

```ts
interface FrameSource {
  start(onFrame: (r: OcrResult) => void): void;
  stop(): void;
}
```

### Repository placement

| Artefact | Path | Note |
|---|---|---|
| Expo app | `mobile/` | The real app directory. `T-1.12` builds on this, not beside it. |
| Demo rule pack | `mobile/src/rulepack/demo-lmpc-v0.json` | **Deliberately not `rulepack/*.json`.** |
| Demo evaluator | `mobile/src/verdict/` | Demo-only. Replaced by `T-1.7` / `T-1.8`. |
| Extraction | `mobile/src/scan/` | Regex/anchor heuristics. Seed for `T-2.1`–`T-2.3`. |

**Why the demo pack is not in `rulepack/`.** `rulepack/validate.py` globs
`rulepack/*.json` (top level, non-recursive) and treats every hit as a real pack that
must satisfy `rulepack.schema.json`. CI's `unreviewed-thresholds` job arms itself the
moment `rulepack/lmpc-2011.json` exists. Writing a schema-conformant pack **is** `T-1.3`
and is hours of work on its own. So the demo carries a simpler, clearly-labelled
subset that cannot be mistaken for the legal artefact and cannot red a gate. A
`README.md` next to it says exactly that.

**Why `mobile/` stays out of the npm workspaces.** The decision log already defers that
to `T-1.12`. Expo + workspace hoisting is a well-known Metro resolution hazard and this
is not the day to debug it. `mobile/` gets its own `package.json` and lockfile, and is
added to the ESLint and Prettier ignore lists so the nine root gates stay green,
untouched, and meaningful.

---

## 4. Phases

Six phases, each sized to one session, in **priority order**. The ordering rule: after
every phase there is a demo you could give — a worse one, but a real one. Stop wherever
the day runs out and what exists still works.

Each phase ends with a `/handoff`. Do not start the next one in the same session.

### Phase tracker

Mirrored in `docs/PROGRESS.md` under **Now**, which is the source of truth. Update both.

| Phase | Goal | Device? | Status |
|---|---|---|---|
| **D-0** | Foundations — app scaffold, native build, rule pack, evaluator, tests | no | `[x]` done |
| **D-1** | Shell on the phone — one still capture reaches ML Kit and prints text | **yes** | `[x]` done |
| **D-2** | The core loop — live OCR, freeze, verdict screen with citations | **yes** | `[x]` done *(freeze superseded by `C-0`'s Capture)* |
| **D-3** | Field trial — tune against real packets until scans behave | **yes** | `[>]` **unblocked by `C-0`** — 2/10 packets |
| **C-0** | **Capture quality** — full-quality still, image upload, preview demoted to viewfinder | **yes** | `[x]` done |
| **A-0** | OCR provider interface + per-provider corpus, so accuracy is a number | no | `[ ]` not blocked |
| **A-4** | Spatial anchor-value association (`T-2.3` pulled forward) | no | `[ ]` not blocked |
| **D-4** | Honest degradation **+ frame admission** — refuse bad frames before OCR runs | **yes** | `[ ]` |
| **D-5** | Polish and rehearsal — icon, APK, demo script, two run-throughs | **yes** | `[ ]` |
| ~~A-1 / A-2 / A-3~~ | ~~Server OCR~~ — **DROPPED**, see §2.1. Cloud-hosted OCR stays a later escalation if `A-0` ever shows ML Kit is not enough | — | `[~]` |

**Execution order is the table order, and nothing in it is blocked on anyone.** No key, no
card, no Docker, no laptop, no GPU.

`C-0` ran first because it is the cheapest accuracy in the project and because **it
unblocks `D-3`** — ten packets photographed with the stock camera app beats ten held in
front of a live scan. It also mattered more than it sounded: every capture before it was a
`skipProcessing` live frame, so **ML Kit had never once been handed a proper photo**.

`A-0` then measures that, on real packets, so any accuracy claim is a number rather than an
assertion (**P8**). It keeps the provider interface so a cloud-hosted engine can be scored
later without touching `extract` or `evaluate` — cheap insurance, not a plan.

`A-4` is now the **largest accuracy win available**, since the engine is fixed. The biggest
defect the field trial found was never an OCR failure: `84.9g` was read correctly and
associated with the wrong anchor.

---

### D-0 — Foundations *(no device needed)*

Everything that can be built and tested without the phone, so device time is never spent
on work that did not need it.

- Expo dev-client app scaffolded in `mobile/`, outside the npm workspaces.
- `withLegacyGradleExt` config plugin — republishes SDK versions on `rootProject.ext`
  so legacy libraries do not silently compile against `compileSdk 28`.
- Debug APK builds green from a cold Gradle run.
- `demo-lmpc-v0.json` — six fields, eight declarations, contested clause letters carried.
- `pack.ts` validating loader, `normalise.ts`, `extract.ts` cascade, `evaluate.ts`.
- Unit tests over synthetic OCR line sets, running in the root `npm test` gate.

**Done when:** `npm test` green, `mobile: npx tsc --noEmit` clean, `assembleDebug` succeeds.

### D-1 — Shell on the phone *(device)*

The smallest thing that proves the device path end to end. No verdict, no overlay.

- Dev client installed and launching on the Nord 4 over USB.
- Camera permission requested and granted; live preview fills the screen.
- One shutter button. Capture → `TextRecognition.recognize` → recognised line count and
  the first few lines rendered on screen.

**Why first:** ML Kit's native binding is the last unproven assumption in the stack. If
it fails, it fails here — with the whole day still ahead and Route B in reserve.

**Done when:** pointing the phone at any printed text shows its lines on screen.

### D-2 — The core loop *(device)* — **the demo itself**

- Continuous capture loop with backpressure: one capture in flight at a time, never a
  queue. Throttle in one constant, tunable on the day.
- Overlay boxes drawn over the preview, scaled from image pixels to view pixels.
- **Freeze** button → run extraction + `evaluate` → verdict screen.
- Verdict screen: overall status, the six fields found/missing, each finding with its
  statute, rule, sub-clause, contested-letter note, pack version and remedy.
- Tap a finding → the evidence region highlighted on the frozen frame.

**Done when:** all five demo beats work on a real packet, once.

### D-3 — Field trial *(device)*

The phase most likely to be skipped and most likely to decide whether the demo works.
Synthetic test lines are a guess about what ML Kit returns; this is the measurement.

- Ten real packets. For each: capture, record the raw OCR lines, note what was missed.
- Tune `lexicons`, `shapes` and thresholds **in the JSON**, never in TypeScript.
- Add each real line set to the test fixtures as it is found, so tuning cannot regress
  an earlier packet.

**Done when:** ten packets scan sensibly and the fixtures still pass.

### C-0 — Capture quality *(device)*

The cheapest accuracy available, and the phase that unblocks `D-3`. No model changes, no
server, no dependencies beyond one picker.

**Three changes, in increasing cost:**

1. **Stop passing `skipProcessing: true` on the frame that gets judged.** That flag skips
   the camera pipeline's autofocus settle, HDR and multi-frame noise reduction — exactly
   the processing that makes 1–2 mm print legible. It was chosen in `D-2` for loop speed,
   which is the right call for a *preview* frame and the wrong one for the frame a verdict
   rests on. **JS-only, no rebuild, free.** It also fixes the parked "frozen frame renders
   sideways" bug, which is caused by that flag leaving EXIF orientation to vary.
2. **Live preview is demoted to a viewfinder.** It keeps the tracking boxes — that is the
   demo's best visual and beat 2 depends on it — but it no longer produces a verdict. Its
   job becomes framing feedback: is there text, is it big enough, is it in frame. This is
   already what §2.1 says about ML Kit; `C-0` makes it literal, and it is the natural home
   for `T-2.7`'s coach hints when `D-4` adds them.
3. **Image upload** — `expo-image-picker`, pick a photo taken with the stock camera app and
   run it through the same pipeline. Costs one ~20 min Gradle rebuild. A stock camera photo
   is a materially better input than any live frame: full sensor resolution, HDR, proper
   autofocus.

**Why this unblocks `D-3`.** Collecting ten packets currently means holding each one in
front of a live scan and hoping the pass lands. With upload, photograph ten packets in five
minutes with the normal camera app and feed them in afterwards. The field-trial recorder
should accept an uploaded image exactly as it accepts a frozen frame, so the corpus does
not care where the picture came from.

It is also how `T-2.8`'s 400-image gold set will have to work, so this is that entry point
built early rather than extra work.

**Input quality this assumes** — the same bar for every engine, Cloud Vision included:
in focus, text filling enough of the frame (characters want roughly 20+ px of height),
no blown-out glare, reasonably square-on. A phone photo taken 15–20 cm from the panel in
decent light clears all four. The existing field-trial captures failed on *framing*, not
camera quality, which is a coaching problem (`T-2.7`), not a hardware one.

**Done when:** a packet photographed with the stock camera app can be fed in, judged, and
recorded to the field-trial corpus; the judged frame is a fully processed capture; and the
live preview no longer produces a verdict on its own.

**What it actually bought, measured on the Nord 4 against one packet (Bhujialalji Navratna
Mix), same scene seconds apart:**

| | Viewfinder pass (`skipProcessing`) | Full-quality capture |
|---|---|---|
| Lines recognised | 32, and on a second pass **0** | **111** |
| Capture | 335 ms | 785 ms |
| OCR | 727 ms | 842 ms |

**3.5x the text for about half a second more**, and the answer to "ML Kit has never been
handed a proper photo" is that the engine was never the binding constraint — the frame was.
The zero-line pass is the sharper number of the two: the panel filled the frame and the
preview frame was simply too blurry to read, which is exactly what `D-4`'s frame admission
is meant to catch.

It did **not** fix extraction. That capture still located 2 of 6 declarations and both were
wrong (`manufacturer: "gls flims Industries"`, `commodity_name: "of india"`) while `150 g`,
`Rs 65.00` and `15JUL.2026` sat legibly in the frame, unfound. That is `A-4`'s territory —
association, not recognition — and it is now evidence for it rather than a hypothesis.

### A-0 — Make accuracy measurable *(no device needed)*

The phase that turns "more accurate" from a claim into a number. Nothing else in this
track is worth starting first: without it there is no way to tell whether an integration
helped, and **P8** forbids quoting a figure that was not measured.

- `OCRProvider` interface in `mobile/src/scan/`, with ML Kit as the first implementation.
  Plan §5.1 already specifies this shape for `T-3.3`; this is that work, brought forward.
- The interface is what makes every later engine cheap. Adding RapidOCR, Surya, docTR or
  OCR.space as an extra column should be minutes, not a phase.
- Field-trial records grow a `provider` field and may hold **several line sets for one
  packet** — the same photograph read by each engine. The JPEG stops being a keepsake and
  becomes the input that lets a new provider be scored against packets already collected.
- `corpus.test.ts` reports per provider: declarations located, values correct against the
  reviewer's `expect` block, and false findings. **Precision first** (**P3**) — a false
  flag is counted more heavily than a miss, and the report says so.
- A provider with no line set for a packet is reported as *not measured*, never as zero.

**Done when:** the existing two packets produce a per-provider table, ML Kit's column is
populated from the records already committed, and adding a provider needs no test changes.

**The first question it must answer:** how much of the field trial's damage was the
*capture*, not the engine? Every record so far came from a `skipProcessing` live frame.
Re-photograph the same packet properly (`C-0`), replay both, and compare. Record 002's
`INCL. OF ALL TAXES` → `NCL. OF 42L TAYES` is the cell to watch — if a good photo fixes it,
ML Kit was never the problem and no escalation is needed.

### A-4 — Spatial anchor-value association *(no device needed)*

`T-2.3`, pulled forward from Sprint 2, where the board already calls it *"the highest-value
task in the project"*. It is the fix for the largest defect the field trial measured, and
**no OCR upgrade addresses it**: in record 002 the true `84.9g` was read correctly and
still lost, because Stage B paired the `NET QTY:` anchor with a line 19 positions away in
the list. Plan §7.2.

- Pair anchor to value by geometry — column overlap, row band, distance — not list index.
- Thresholds are **pack data, not code** (**P6**), and are chosen against the field-trial
  corpus, never against a single packet.
- Record 002's `expect` block changes from `null` to `"84.9 g"` when this lands. That is
  the acceptance test, and it is already written down.

**Done when:** record 002 yields `84.9 g`, record 001 still yields nothing for that field,
and no earlier packet regresses.

### D-4 — Honest degradation and frame admission *(device)*

The beat that answers "is it ever wrong?", and the phase that keeps the demo truthful.
**Expanded 2026-09-10** to pull the frame-admission half of `T-2.7` forward (plan §6.2,
§11.3), because refusing a bad frame prevents a wrong verdict at the source rather than
catching it afterwards. This is layer 1 of four; the other three already work.

**Frame admission — new, and the reason for the expansion:**

- Score each frame before OCR runs: **blur**, **glare**, **text coverage**. A frame that
  fails is not read at all — no OCR, no extraction, no verdict, no chance to be wrong.
- Scoring thresholds are **pack data, not code** (**P6**), and live beside the existing
  `evidence_thresholds`. They are method parameters, not statutory values.
- **Freeze on the best of the last few frames, not the last one.** The loop already
  captures 2–4 per second and currently keeps whichever arrived last. Once a frame can be
  scored, keeping the best costs nothing and is the cheapest accuracy in the phase.
- The score is *shown*, not hidden — an officer should see why a frame was rejected.

**The rest of the phase, unchanged:**

- `INSUFFICIENT_EVIDENCE` path visible and distinct from `NO_ISSUES_FOUND`.
- Advisory banner naming the pack, its version and its unreviewed status.
- Coach hints — move closer, hold steadier, tilt to kill the glare, find the panel.
  These now have a real signal behind them rather than being guesses.
- Verified in aeroplane mode, from a cold app start.

**The four layers this completes.** Together these are the honest answer to "how do you
avoid a wrong verdict?", and three of them already work:

| Layer | Mechanism | State |
|---|---|---|
| 1 — do not read a bad picture | frame admission, coach hints | **this phase** |
| 2 — do not guess when unsure | word-boundary anchors, Stage B geometry, no unanchored quantity, `requires_anchored_field` | done `D-3` |
| 3 — do not judge on thin evidence | `min_ocr_lines`, `min_fields_found` → `INSUFFICIENT_EVIDENCE` | done `D-2` |
| 4 — never accuse, always show | advisory-only cap, evidence box on every finding | done `D-2` |

**What this still cannot do**, and the demo must say so plainly: if OCR reads `84.9g` as
`8.9g`, nothing downstream can know — the value is plausible and well-formed. Layer 4 is
the real defence, and it is a human one. The app never makes the final call; it points an
officer at a region and they decide (**P7**). A tool that claimed certainty here would be
dangerous.

**Done when:** a deliberately bad capture is refused *before* OCR runs and says which
check it failed, and a good capture of the same packet passes.

### D-5 — Polish and rehearsal *(device)*

- App name, icon, sunlight-legible contrast, one-handed reach.
- Standalone debug APK that runs with the laptop unplugged.
- `docs/DEMO_SCRIPT.md` — the five beats plus the failure path, timed.
- Two full rehearsals.

**Done when:** the demo runs twice, start to finish, from the APK alone.

---

### Cut lines

Decided now, so they are not decided at midnight.

| If short on time | Cut |
|---|---|
| In **D-2** | Live loop → tap-to-capture (Route C). Costs one visual beat, saves the phase. |
| In **D-2** | Evidence crops → a highlight box on the frozen frame. Still satisfies P7. |
| In **D-4** | Glare scoring and best-of-N frame selection. Keep blur scoring, the coach hints and `INSUFFICIENT_EVIDENCE` — those are the beat. |
| In **D-5** | Icon and contrast work. A plain app that works beats a pretty one that stalls. |
| In **C-0** | Image upload, **not** the `skipProcessing` fix. The upload costs a Gradle rebuild; dropping the flag is free and is most of the benefit. |
| Whole phase | **D-5 before D-4, and D-4 before D-3.** Never drop D-3 to reach D-5 — an unpolished demo that reads real labels beats a polished one that does not. |
| Whole phase | **Never cut `A-0` or `A-4` to reach a provider integration.** `A-0` is the only thing that makes the accuracy claim true; `A-4` fixes the biggest measured defect and needs no key, no host and no network. |
| Any time | **Never cut:** the citations, the advisory badge, or aeroplane mode. Those are the demo. |

---

## 5. Definition of done

- [ ] APK installs and runs on the Nord 4 with the laptop unplugged.
- [ ] Full scan → verdict loop completes in aeroplane mode.
- [ ] A packet photographed with the stock camera app can be uploaded, judged and recorded.
- [ ] An accuracy table exists in `docs/PROGRESS.md`, generated from `field-trial/`, with
      every figure traceable to a recorded packet (**P8**).
- [ ] Record 002 yields `84.9 g` for net quantity (`A-4`'s acceptance test).
- [ ] Every finding shows statute, rule id, sub-clause, and rule-pack version.
- [ ] Every finding shows an image region.
- [ ] No finding renders as `violation`; all are `advisory`.
- [ ] A deliberately bad capture yields `INSUFFICIENT EVIDENCE`.
- [ ] `npm run format:check`, `lint`, `typecheck`, `test`, `ruff check .`, `ruff format --check .`, `pytest`, `npm audit`, `python rulepack/validate.py` — all nine still green.
- [ ] `docs/DEMO_SCRIPT.md` exists and has been rehearsed twice.
- [ ] `docs/PROGRESS.md` records the detour and points the next session at `T-1.3`.

---

## 6. After the demo

The next session starts at **`T-1.3`** — `rulepack/lmpc-2011.json`, Rule 6 universal
declarations, plan §4.2. Unchanged. The demo does not alter the board, the sprint goals,
or any entry in the decisions log.

What the demo hands forward:

- A working Expo dev-client on the target device — most of `T-1.12` de-risked.
- Real ML Kit output from real Indian labels — direct input to `T-2.1`–`T-2.3`, which
  are otherwise designed blind.
- A first honest read on which of the six declarations are hard to extract, which
  should shape the gold-set strata in `T-2.8`.

What the demo must **not** be allowed to become:

- The demo evaluator is not the real evaluator. `T-1.7` writes that one against the
  real schema, with a Python twin and a conformance suite. Do not promote demo code.
- The demo pack is not the real pack. `T-1.3` writes that one.
