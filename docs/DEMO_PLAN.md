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
   per frame), and the **frozen panel is re-read by the default server engine** before a
   verdict is computed. §2.1 defines the order.
2. **Extraction** of six Rule 6 universal declarations from the OCR line set:
   - common / generic name of the commodity
   - net quantity with unit
   - retail sale price (MRP)
   - month & year of manufacture / packing
   - name & address of the manufacturer / packer / importer
   - consumer care contact (phone or email)
3. **Deterministic evaluator** — a pure function `(fields, rulepack) → verdict`. No
   learned parameters, no network, no clock-dependent behaviour.
4. **Demo rule pack** — the six declarations as JSON data with clause ids,
   `alternate_readings` for the contested sub-clause letters, and provenance status.
5. **Verdict screen** — overall status, per-finding citation, evidence crop.
6. **Visible degradation** — coverage / confidence banner; `INSUFFICIENT EVIDENCE`
   when the OCR line set is too thin to conclude anything.
7. **A measured accuracy figure** — the same recorded packets replayed through every
   provider, so "more accurate" is a number from `field-trial/`, not an assertion (**P8**).
8. **Visible provenance of the reading** — the verdict screen names which engine produced
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

Decided by the user on 2026-09-10. **Accuracy is the primary metric and the most accurate
reachable engine wins.**

| Order | Provider | Where it runs | Used for |
|---|---|---|---|
| **1 — default** | **Google Cloud Vision** `DOCUMENT_TEXT_DETECTION` | Google, over the internet | The verdict, whenever the internet is reachable |
| **2 — fallback** | **PaddleOCR**, self-hosted | The user's laptop, phone joins its hotspot | The verdict when the internet is down but the laptop is present |
| **3 — live preview only** | **ML Kit** | On the phone | Preview boxes and framing feedback. **Never the verdict.** |
| **none reachable** | — | — | **The app refuses to give a verdict** and says why |

**The refusal is the user's explicit decision and it supersedes P2.** `CLAUDE.md` states
*"Offline first — the device must reach a verdict alone. Network is an enhancement path,
never a dependency."* That is no longer true of this build. The reasoning accepted: a
verdict an officer cannot trust sends them back to manual inspection, so a low-confidence
offline answer is worth less than an honest refusal. The costs, recorded so they are not
rediscovered:

- The demo can no longer be given in aeroplane mode, and beat 1 has been rewritten.
- `T-3.2` (offline outbox), `T-3.4` (on-device provisional verdict) and `T-6.4`
  (aeroplane-mode rehearsal) now contradict this and must be re-scoped, not silently left.
- SIH venue wifi is unreliable; provider 2 exists precisely so a dead internet connection
  does not end the demo. **Rehearse on the hotspot, not on venue wifi.**

**What better OCR does and does not fix.** Measured on the two real records, not assumed.
Of the four defects the field trial found, **one** was a recognition failure
(`INCL. OF ALL TAXES` read as `NCL. OF 42L TAYES`). The other three were our own logic —
including the one that matters most, `net_quantity` reporting `15.1g` when the true
`84.9g` **had been read correctly by ML Kit** and was simply associated with the wrong
anchor. No OCR upgrade fixes that class. It is `T-2.3`, spatial anchor-value association,
and it is pulled forward into this track as `A-4`. **Shipping better OCR without `A-4`
buys a sharper camera pointed at the wrong line.**

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
| **A-0** | OCR provider interface + per-provider corpus, so accuracy is a number | no | `[ ]` |
| **A-1** | Cloud Vision as the default provider | **yes** | `[ ]` blocked on GCP key |
| **A-4** | Spatial anchor-value association (`T-2.3` pulled forward) | no | `[ ]` |
| **A-2** | PaddleOCR self-hosted fallback over the laptop hotspot | **yes** | `[ ]` blocked on Docker |
| **D-4** | Honest degradation — insufficient evidence, coach hints, no-server refusal | **yes** | `[ ]` |
| **A-3** | Accuracy readout — engine, latency and confidence on screen | **yes** | `[ ]` |
| **D-5** | Polish and rehearsal — icon, APK, demo script, two run-throughs | **yes** | `[ ]` |

**Execution order is the table order.** `A-0` comes before any provider work because
without it "Cloud Vision is more accurate" is a vendor claim rather than a measurement,
and there would be no way to tell whether an integration helped. `A-4` sits between the
two provider phases deliberately — it is the fix for the largest measured defect and it
is free of network, keys and hosting, so it lands even if both provider phases stall.

**`A-1` and `A-2` are both blocked on the user** (a GCP key; Docker installed). `A-0` and
`A-4` are not blocked on anything and are where to start.

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

### A-0 — Make accuracy measurable *(no device needed)*

The phase that turns "more accurate" from a claim into a number. Nothing else in this
track is worth starting first: without it there is no way to tell whether an integration
helped, and **P8** forbids quoting a figure that was not measured.

- `OCRProvider` interface in `mobile/src/scan/`, with ML Kit as the first implementation.
  Plan §5.1 already specifies this shape for `T-3.3`; this is that work, brought forward.
- Field-trial records grow a `provider` field and may hold **several line sets for one
  packet** — the same photograph read by each engine. The JPEG stops being a keepsake and
  becomes the input that lets a new provider be scored against packets already collected.
- `corpus.test.ts` reports per provider: declarations located, values correct against the
  reviewer's `expect` block, and false findings. **Precision first** (**P3**) — a false
  flag is counted more heavily than a miss, and the report says so.
- A provider with no line set for a packet is reported as *not measured*, never as zero.

**Done when:** the existing two packets produce a per-provider table, ML Kit's column is
populated from the records already committed, and adding a provider needs no test changes.

### A-1 — Cloud Vision as the default provider *(device)*

- `POST /ocr` on a minimal FastAPI service — stateless, no Postgres, no auth beyond a
  shared secret. It exists to hold the API key, because **the key must never ship inside
  the APK**, where anyone can extract it from the bundle.
- Panel JPEG uploaded on freeze; `DOCUMENT_TEXT_DETECTION`; the response mapped into the
  same `OcrLine` shape with boxes, so `extract` and `evaluate` are untouched (**P1**).
- Per-stage timings recorded end to end: capture, upload, OCR, download, evaluate. The
  §16 budget is written against on-device latency and **will be broken** by a round trip.
  Record the real figure rather than quietly dropping the budget.
- Replay the field-trial packets through it and fill the `cloud_vision` column from `A-0`.

**Blocked on:** a GCP project with billing enabled and a Vision API key. Only the user
can create this. **Done when:** the per-provider table shows Cloud Vision against ML Kit
on the same packets, and the number is written into `docs/PROGRESS.md`.

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

### A-2 — PaddleOCR fallback over the laptop hotspot *(device)*

The venue-safety net. SIH halls have unreliable wifi and the whole demo now depends on
reaching a server.

- PaddleOCR behind the same `/ocr` contract as `A-1`, containerised, on the user's laptop.
- Phone joins the laptop's hotspot. **No internet involved** — this path works in a hall
  with no connectivity at all, which is the point.
- Provider selection: try Cloud Vision, fall back on timeout or network error, and **say
  on screen which one answered** (**P9**).
- Fill the `paddleocr` column of the `A-0` table.

**Blocked on:** Docker Desktop, not installed on this machine. **Done when:** the phone
reaches a verdict with the laptop's wifi off and mobile data off, over the hotspot alone,
and the screen names PaddleOCR as the source.

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
| In **A-1** | Nothing. If Cloud Vision cannot be reached, `A-2` becomes the default rather than the fallback — the tiering is the same code either way. |
| In **A-2** | The hotspot path, **only if** venue internet has been tested and is reliable. This is the riskiest cut on the page. |
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
- [ ] The verdict screen names the engine that read the label and its latency.
- [ ] A per-provider accuracy table exists in `docs/PROGRESS.md`, generated from
      `field-trial/`, with every figure traceable to a recorded packet (**P8**).
- [ ] Record 002 yields `84.9 g` for net quantity (`A-4`'s acceptance test).
- [ ] The Cloud Vision key is not present anywhere in the APK.
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
