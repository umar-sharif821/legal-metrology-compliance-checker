# Demo Plan — core loop, then accuracy

> **Status:** active detour. Not a replacement for `docs/IMPLEMENTATION_PLAN_v2.pdf`.
> When the demo ships, the board resumes at **`T-1.3`** exactly where it was.
>
> **Created:** 2026-09-10 · **Target device:** OnePlus Nord 4 (physical, USB)
>
> **Revised 2026-09-10 — scope changed by the user.** Accuracy is the product: an
> officer who cannot trust the result inspects by hand anyway, which is the problem
> this tool exists to remove. Server OCR is therefore **in**, and is the **default**
> path, not an enhancement. See §2.1. **This is no longer a one-day plan** — the
> original budget was one day for the core loop; the accuracy track (`A-0`…`A-4`)
> adds a backend, two OCR integrations and the spatial-association work pulled
> forward from Sprint 2. Budget it separately and honestly.

---

## 1. What the demo is

One Android app, installed on the user's own phone, that does this and nothing else:

> Point the phone at a packaged product label. Text is recognised live on the preview.
> Tap **Freeze** and the app names which mandatory declarations under the Legal Metrology
> (Packaged Commodities) Rules, 2011 it found, which it did not, and cites the clause for
> each — with the image region a human can look at to agree or disagree.

That is the whole pitch. Everything below serves it or is cut.

**What changed on 2026-09-10.** The original pitch ended "in aeroplane mode", and beat 1
was the offline story. That is gone: the user's decision is that the most accurate engine
available is the default, and that with no server reachable the app **refuses to give a
verdict** rather than falling back to a lower-accuracy on-device read. The offline claim
is therefore withdrawn from the demo, and the opening beat becomes the accuracy
measurement instead — a weaker differentiator against other teams, but the one the user
has judged matters more to a real officer. See the decisions log in `docs/PROGRESS.md`.

### The five beats of the live demo

| # | Beat | What the judge sees | Principle it proves |
|---|---|---|---|
| 1 | The same packet read by the phone alone, then by the server model, side by side | A measured accuracy difference, not a claim | **P8** measure what you claim |
| 2 | Live preview, text boxes tracking the label | It is reading, not guessing | — |
| 3 | Freeze → verdict in under a second | Six declarations, found/missing | — |
| 4 | Every finding names statute, rule, sub-clause, pack version | Not a vibe, a citation | **P1** deterministic, **P6** rules are data |
| 5 | Tap a finding → the exact crop it came from | A person can overrule the machine | **P7** evidence is for a human |

### The sixth beat, if asked "is it ever wrong?"

Show an unreadable / partial capture. The app says **`INSUFFICIENT EVIDENCE`**, not
`COMPLIANT`. Every finding is badged `advisory`, never `violation`, because the demo
rule pack is `PENDING_LEGAL_REVIEW`. That is **P3** and **P9**, and it is a stronger
answer than a perfect scan.

---

## 2. Scope

### In — core features

1. **Live camera + OCR through a provider interface** — ML Kit on-device drives the live
   preview (it is the only engine fast enough to run continuously and free enough to run
   per frame), and the **captured panel is re-read by the default server engine** before a
   verdict is computed. §2.1 defines the order.
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
8. **A measured accuracy figure** — the same recorded packets replayed through every
   provider, so "more accurate" is a number from `field-trial/`, not an assertion (**P8**).
9. **Visible provenance of the reading** — the verdict screen names which engine produced
   the text it judged, and its latency. A result from the phone's own OCR must never be
   presentable as a server-quality one (**P9**).

### Out — deliberately cut for the demo

Each of these has a task on the real board. None is deleted, all are deferred.

| Cut | Why | Returns at |
|---|---|---|
| ~~Backend~~ — **now IN, see §2.1** | Reversed 2026-09-10: the default OCR path is server-side | `A-1`, `A-2` |
| Postgres, sync, dashboard | Still nothing in the beats needs them; the OCR endpoint is stateless | `T-1.10`, Sprint 4 |
| Python evaluator + conformance suite | One evaluator cannot diverge from itself | `T-1.8`, `T-1.9` |
| Hindi / Devanagari OCR and UI | Devanagari model is weak on real labels; a visible miss costs more than the feature earns | `T-2.5`, `T-5.5` |
| Any millimetre measurement, Rule 7 height, Rule 8(2) parity | **P4** — no number without a stated scale reference, and the demo has none | `T-1.4`, `T-3.7`, `T-5.7` |
| Barcode / GS1 identity | Cheap but not one of the five beats | `T-2.6`, `T-4.1` |
| Scan history, PDF export, corrections loop | Not in the five beats | `T-3.8`, `T-4.8`, `T-5.4` |
| Applicability gates (exempt packs, small quantity) | **P5** matters, but the thresholds are unverified and gates are `T-1.5` | `T-1.5` |
| E-commerce sweep | Whole separate surface | Sprint 5 |

### 2.1 OCR providers, in the order the app tries them

Decided by the user on 2026-09-10, **revised the same day** once the cost and hosting of
each option were worked through. **Accuracy is the primary metric and the most accurate
reachable engine wins — but it must be free, because there is no budget.**

| Order | Provider | Where it runs | Used for |
|---|---|---|---|
| **1 — default** | **PaddleOCR server models**, self-hosted | The user's laptop now; a cloud host in real deployment | The verdict |
| **2 — live preview only** | **ML Kit** | On the phone | Preview boxes and framing feedback. **Never the verdict.** |
| **none reachable** | — | — | **The app refuses to give a verdict** and says why |
| *parked* | *Cloud Vision, Surya* | *see the escalation ladder below* | *only if `A-0` measures PaddleOCR as insufficient* |

**Why PaddleOCR and not Cloud Vision.** Cloud Vision is likely more accurate on the worst
frames, but requires a billing account with a card on file, and there is no budget.
PaddleOCR is Apache-2.0, free forever, needs no card, no account and no quota, returns
real per-line bounding boxes (**P7**, and `A-4` needs them), and supports Devanagari, which
ML Kit cannot read at all. Its *server* models close most of the ML-Kit-to-Cloud-Vision gap
on printed panel text. What remains is glare and heavy crumpling — frames `T-2.7` should be
rejecting rather than reading.

**PaddleOCR is a library, not a hosted API.** There is nothing to subscribe to; you run it.
`pip install paddlepaddle paddleocr fastapi uvicorn` plus a small FastAPI wrapper —
**no Docker**, which removes that blocker entirely.

**The laptop is a stand-in for a cloud server, not the architecture.** This matters and is
easy to misread:

```
DEV + DEMO                          REAL DEPLOYMENT
  [Phone] --USB or hotspot-->         [Officer's phone] --mobile data-->
  [Laptop running PaddleOCR]          [Cloud host running PaddleOCR]
  no internet involved                the same code, a different URL
```

The app holds a URL in config and never knows which it is talking to. The demo uses the
laptop so it cannot be killed by venue wifi; production uses `T-1.10`/`T-1.11`, already on
the board. **Reaching the phone in development:** `adb reverse tcp:8000 tcp:8000` over the
cable already plugged in — no wifi at all. **On stage:** laptop hotspot, phone joins it.
Note the phone's wifi is currently *off* (it runs on mobile data), so it must be turned on
for the hotspot path.

**Free escalation ladder, if `A-0` shows PaddleOCR is not enough.** Do not jump to a credit
card:

1. **RapidOCR** — PaddleOCR's models on ONNX. Same accuracy, lighter and faster to host.
2. **Surya OCR** — often stronger than PaddleOCR on hard text. Free at your scale; prefers
   a GPU and is a heavier install.
3. **docTR** (Apache 2.0) — another free alternative worth a column in the `A-0` table.
4. **Only then** Cloud Vision — and even then via the $300/90-day trial credit, SIH sponsor
   credits (ask the SPOC — Google/AWS/Azure sponsor SIH and most teams never claim them),
   or the GitHub Student Pack. Its free tier is ~1,000 images/month but still needs a card.

**Rejected: OCR.space.** Free without a card, but the free tier caps uploads at about 1 MB
against the app's 3.6 MB captures — downscaling that hard destroys exactly the 1–2 mm
declaration print this tool exists to read. Worth twenty minutes as an `A-0` column to
confirm, never as the default.

**Rejected: a vision-language model doing the extraction** (Gemini's free tier or similar).
It would probably read these labels better than any dedicated OCR engine. It would also
delete the differentiator: **P1** requires the decision layer to be a pure function with no
learned parameters, and **P6** requires rules to be data. A judge asking *"how do you know
this pack is missing its MRP?"* currently gets a clause number, a pack version and a pixel
region; with a VLM the answer is "the model said so". Using one purely as an OCR engine is
defensible in principle, but its bounding boxes are approximate, which breaks **P7** and
starves `A-4`.

**Refusing a verdict with no provider reachable supersedes P2.** `CLAUDE.md` states
*"Offline first — the device must reach a verdict alone. Network is an enhancement path,
never a dependency."* That is no longer true of this build. Reasoning accepted: a verdict
an officer cannot trust sends them back to manual inspection. Costs, recorded so they are
not rediscovered:

- The demo can no longer be given in aeroplane mode, and beat 1 has been rewritten.
- **In real deployment, an officer with no mobile signal gets no verdict at all** — a
  basement, a warehouse, a rural market. This is a product behaviour, not a demo detail.
- `T-3.2` (offline outbox), `T-3.4` (on-device provisional verdict) and `T-6.4`
  (aeroplane-mode rehearsal) now contradict this and must be re-scoped, not silently left.
- The problem statement does not appear to require offline operation (user, 2026-09-10),
  so this is not believed to be a scoring risk.

**What better OCR does and does not fix.** Measured on the two real records, not assumed.
Of the four defects the field trial found, **one** was a recognition failure
(`INCL. OF ALL TAXES` read as `NCL. OF 42L TAYES`). The other three were our own logic —
including the one that matters most, `net_quantity` reporting `15.1g` when the true
`84.9g` **had been read correctly by ML Kit** and was simply associated with the wrong
anchor. No OCR upgrade fixes that class. It is `T-2.3`, spatial anchor-value association,
and it is pulled forward into this track as `A-4`. **Shipping better OCR without `A-4`
buys a sharper camera pointed at the wrong line.**

**On-device PaddleOCR was considered and not chosen.** PP-OCR mobile models are ~15 MB and
built for phones, so it is possible — but there is no maintained React Native binding, so
the route is ONNX Runtime Mobile with converted models: a new native dependency, a full
Gradle rebuild, ~15–30 MB of models in the APK, and hand-written tensor pre/post-processing
where ML Kit hands you lines and boxes. Days of work. And the mobile models are markedly
weaker than the server models, so it would cost the accuracy the change exists to buy.
Revisit only if the no-signal case becomes a requirement — it is the one route that would
restore P2. `A-0` can score the mobile models cheaply if that question ever reopens.

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
| **D-2** | The core loop — live OCR, freeze, verdict screen with citations | **yes** | `[x]` done |
| **D-3** | Field trial — tune against real packets until scans behave | **yes** | `[>]` blocked on packets |
| **C-0** | **Capture quality** — full-quality still, image upload, preview demoted to viewfinder | **yes** | `[ ]` **not blocked — start here** |
| **A-0** | OCR provider interface + per-provider corpus, so accuracy is a number | no | `[ ]` not blocked |
| **A-2** | **PaddleOCR self-hosted as the default provider** | **yes** | `[ ]` not blocked |
| **A-4** | Spatial anchor-value association (`T-2.3` pulled forward) | no | `[ ]` not blocked |
| **D-4** | Honest degradation — insufficient evidence, coach hints, no-provider refusal | **yes** | `[ ]` |
| **A-3** | Accuracy readout — engine, latency and confidence on screen | **yes** | `[ ]` |
| **D-5** | Polish and rehearsal — icon, APK, demo script, two run-throughs | **yes** | `[ ]` |
| ~~A-1~~ | ~~Cloud Vision~~ — **PARKED**, escalation only if `A-0` says PaddleOCR is not enough | — | `[~]` |

**Execution order is the table order, and nothing in it is blocked on anyone.** The GCP key
and the Docker install are both gone as blockers: PaddleOCR needs neither.

`C-0` runs first because it is the cheapest accuracy in the project — no model change, no
server, no key — and because **it unblocks `D-3`**. Every engine below it reads whatever
image it is handed; improving the image improves all of them at once.

`A-0` comes before any provider work because without it "PaddleOCR is more accurate" is a
claim from a benchmark on somebody else's images rather than a measurement on yours, and
**P8** bars quoting a figure that was not measured. It also makes every later provider
cheap to evaluate — adding RapidOCR, Surya, docTR or OCR.space as a column is minutes once
the interface exists.

`A-4` sits after the provider work but is independent of it, so it lands even if hosting
stalls. It fixes the largest defect the field trial measured, and no OCR upgrade touches
that class of failure.

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

**The first question it must answer:** record 002 read `INCL. OF ALL TAXES` as
`NCL. OF 42L TAYES` — the crinkled-foil failure, and the one case where a better engine
genuinely helps. Does PaddleOCR read that line correctly? That single cell decides whether
anything further up the escalation ladder is needed.

### A-2 — PaddleOCR self-hosted, as the default provider *(device)*

The engine that decides the verdict. Free, no card, no quota, no Docker.

- `POST /ocr` on a minimal FastAPI service — stateless, no Postgres, no auth beyond a
  shared secret. Accepts a JPEG, returns lines with per-line bounding boxes mapped into
  the app's existing `OcrLine` shape, so `extract` and `evaluate` are untouched (**P1**).
- `pip install paddlepaddle paddleocr fastapi uvicorn`. **Server** models, not mobile —
  the accuracy difference between them is the point of this phase.
- Phone reaches it by `adb reverse tcp:8000 tcp:8000` while developing (no wifi at all),
  and by the laptop's hotspot on stage. The phone's wifi is currently off; turn it on.
- The endpoint URL is **config, not code**. The same build must point at a cloud host in
  real deployment without a rebuild.
- Per-stage timings recorded end to end: capture, upload, OCR, download, evaluate. The
  §16 latency budget was written against on-device OCR and **will be broken** by a round
  trip. Record the real figure rather than quietly dropping the budget (**P8**).
- Replay the field-trial packets through it and fill the `paddleocr_server` column of the
  `A-0` table. **This is the phase that either settles the accuracy question or sends you
  up the escalation ladder in §2.1.**

**Done when:** the phone reaches a verdict with no internet — laptop hotspot only, mobile
data off — the screen names PaddleOCR as the source, and the per-provider table shows it
against ML Kit on the same packets, with the number written into `docs/PROGRESS.md`.

### ~~A-1~~ — Cloud Vision *(PARKED)*

Not being built. Kept on the page so the reasoning is not rediscovered.

Reached for **only** if `A-0` measures PaddleOCR as insufficient on real packets, and only
after RapidOCR, Surya and docTR have been tried — all free (see the escalation ladder in
§2.1). Cloud Vision needs a billing account with a card on file even inside its ~1,000
images/month free tier, and there is no budget. If it ever is built: the API key lives on
the server and **never inside the APK**, where anyone can extract it from the bundle. Look
at the $300/90-day trial credit and at SIH sponsor credits before spending anything.

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

### A-3 — Accuracy readout on screen *(device)*

Makes the tiering legible to a judge instead of hidden.

- The verdict screen names the engine, its latency, and the pack version.
- A result the phone's own OCR produced can never render as a server result — this is
  moot while ML Kit is barred from the verdict, and must stay true if that ever changes.
- The no-server refusal from `D-4` names what it tried and what to do about it.

**Done when:** a judge can tell, from the screen alone, which engine read the label.

### D-4 — Honest degradation *(device)*

The beat that answers "is it ever wrong?", and the phase that keeps the demo truthful.

- `INSUFFICIENT_EVIDENCE` path visible and distinct from `NO_ISSUES_FOUND`.
- Advisory banner naming the pack, its version and its unreviewed status.
- Coach hints — move closer, hold steadier, find the declaration panel.
- **`NO_PROVIDER_REACHABLE`** — a fourth status, distinct from all three above. Neither
  Cloud Vision nor PaddleOCR answered, so there is no verdict. It names both attempts and
  what to do. Per the user's 2026-09-10 decision it must **not** fall back to ML Kit.
- ~~Verified in aeroplane mode, from a cold app start.~~ **Withdrawn** — aeroplane mode now
  produces a refusal by design. What is verified instead: the refusal is reached from a
  cold start, is not mistakable for a clean label, and recovers when a provider returns.

**Done when:** a deliberately bad capture refuses to give a verdict and says why, **and**
a capture with no provider reachable refuses differently, and says why differently.

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
| In **D-4** | Coach hints. Keep `INSUFFICIENT_EVIDENCE` — that one is a beat. |
| In **D-5** | Icon and contrast work. A plain app that works beats a pretty one that stalls. |
| In **A-2** | Server models → PaddleOCR's **mobile** models, if the laptop is too slow. Costs accuracy, keeps the phase. Do not cut the hotspot path — it is what makes the demo immune to venue wifi. |
| Whole phase | **D-5 before D-4, and D-4 before D-3.** Never drop D-3 to reach D-5 — an unpolished demo that reads real labels beats a polished one that does not. |
| Whole phase | **Never cut `A-0` or `A-4` to reach a provider integration.** `A-0` is the only thing that makes the accuracy claim true; `A-4` fixes the biggest measured defect and needs no key, no host and no network. |
| Any time | **Never cut:** the citations, the advisory badge, or the engine-name readout. Those are the demo. |

---

## 5. Definition of done

- [ ] APK installs and runs on the Nord 4 with the laptop unplugged.
- [ ] ~~Full scan → verdict loop completes in aeroplane mode.~~ **Withdrawn 2026-09-10.**
      Replaced by: aeroplane mode produces `NO_PROVIDER_REACHABLE`, which is visibly
      distinct from both a clean label and a bad capture.
- [ ] Full scan → verdict completes over the laptop hotspot with no internet at all.
- [ ] The `/ocr` URL is configuration, not code — the same APK can point at a cloud host.
- [ ] The verdict screen names the engine that read the label and its latency.
- [ ] A per-provider accuracy table exists in `docs/PROGRESS.md`, generated from
      `field-trial/`, with every figure traceable to a recorded packet (**P8**).
- [ ] Record 002 yields `84.9 g` for net quantity (`A-4`'s acceptance test).
- [ ] Record 002's `INCL. OF ALL TAXES` line is read correctly by the default provider,
      or the table says plainly that it is not.
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
