# Demo Plan — one day, core loop only

> **Status:** active detour. Not a replacement for `docs/IMPLEMENTATION_PLAN_v2.pdf`.
> When the demo ships, the board resumes at **`T-1.3`** exactly where it was.
>
> **Created:** 2026-09-10 · **Budget:** 1 day (~10 working hours) · **Target device:** OnePlus Nord 4 (physical, USB)

---

## 1. What the demo is

One Android app, installed on the user's own phone, that does this and nothing else:

> Point the phone at a packaged product label. Text is recognised live on the preview.
> Tap **Freeze** and the app names which mandatory declarations under the Legal Metrology
> (Packaged Commodities) Rules, 2011 it found, which it did not, and cites the clause for
> each — with the image region a human can look at to agree or disagree. In aeroplane mode.

That is the whole pitch. Everything below serves it or is cut.

### The five beats of the live demo

| # | Beat | What the judge sees | Principle it proves |
|---|---|---|---|
| 1 | Aeroplane mode is on before the app opens | No network the entire demo | **P2** offline first |
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

1. **Live camera + continuous on-device OCR** (English / Latin script, ML Kit).
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
7. **Fully offline.** The app makes zero network calls. Verified in aeroplane mode.

### Out — deliberately cut for the demo

Each of these has a task on the real board. None is deleted, all are deferred.

| Cut | Why | Returns at |
|---|---|---|
| Backend, Postgres, sync, dashboard | Nothing in the five beats needs a server | `T-1.10`, Sprint 4 |
| Python evaluator + conformance suite | One evaluator cannot diverge from itself | `T-1.8`, `T-1.9` |
| Hindi / Devanagari OCR and UI | Devanagari model is weak on real labels; a visible miss costs more than the feature earns | `T-2.5`, `T-5.5` |
| Any millimetre measurement, Rule 7 height, Rule 8(2) parity | **P4** — no number without a stated scale reference, and the demo has none | `T-1.4`, `T-3.7`, `T-5.7` |
| Barcode / GS1 identity | Cheap but not one of the five beats | `T-2.6`, `T-4.1` |
| Scan history, PDF export, corrections loop | Not in the five beats | `T-3.8`, `T-4.8`, `T-5.4` |
| Applicability gates (exempt packs, small quantity) | **P5** matters, but the thresholds are unverified and gates are `T-1.5` | `T-1.5` |
| E-commerce sweep | Whole separate surface | Sprint 5 |

### Not negotiable even in a demo

These survive the cut because dropping them would make the demo dishonest:

- No statutory value hard-coded in `.ts`. The demo pack is data, loaded at runtime. (**P6**)
- Nothing marked `PENDING_LEGAL_REVIEW` may render as `violation`. (**P3**, working agreements)
- Contested sub-clause letters carry both readings. No silent pick. (open question, §2.2)
- Every finding carries a crop reference. (**P7**)
- Latency numbers, if quoted at all, come from the Nord 4. (**P8**)

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
| **D-2** | The core loop — live OCR, freeze, verdict screen with citations | **yes** | `[>]` next |
| **D-3** | Field trial — tune against real packets until scans behave | **yes** | `[ ]` |
| **D-4** | Honest degradation — insufficient evidence, coach hints, offline proof | **yes** | `[ ]` |
| **D-5** | Polish and rehearsal — icon, APK, demo script, two run-throughs | **yes** | `[ ]` |

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

### D-4 — Honest degradation *(device)*

The beat that answers "is it ever wrong?", and the phase that keeps the demo truthful.

- `INSUFFICIENT_EVIDENCE` path visible and distinct from `NO_ISSUES_FOUND`.
- Advisory banner naming the pack, its version and its unreviewed status.
- Coach hints — move closer, hold steadier, find the declaration panel.
- Verified in aeroplane mode, from a cold app start.

**Done when:** a deliberately bad capture refuses to give a verdict, and says why.

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
| Whole phase | **D-5 before D-4, and D-4 before D-3.** Never drop D-3 to reach D-5 — an unpolished demo that reads real labels beats a polished one that does not. |
| Any time | **Never cut:** the citations, the advisory badge, or aeroplane mode. Those are the demo. |

---

## 5. Definition of done

- [ ] APK installs and runs on the Nord 4 with the laptop unplugged.
- [ ] Full scan → verdict loop completes in aeroplane mode.
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
