# Pitch — SIH26034, Legal Metrology Compliance Checker

Written for the hackathon round. Read it once, rehearse the demo three times, then stop
touching the code.

---

## The one sentence

> Anyone can OCR a label. We built the part that survives being argued with — every flag
> cites its clause, shows the pixels behind it, and refuses to answer when the picture
> cannot support one.

## Why that is the right sentence

Half the room will demo a model that reads a label and prints "compliant / non-compliant".
A Legal Metrology officer cannot act on that: an enforcement action gets challenged, and
"the AI said so" collapses. The differentiator is not accuracy. It is **defensibility**.

Do not lead with the tech stack. Lead with the officer's problem.

---

## The three-minute demo

Have `npm run dev` running before you walk up, on `/how`. Never debug in front of judges.

**0:00 — the problem (spoken, no screen).**
"A Legal Metrology officer checks around eighty packages a day against eight mandatory
declarations. The bottleneck isn't spotting text — it's writing a finding that holds up
when the manufacturer disputes it."

**0:30 — a clean scan.** `/scan` → specimen **Biscuits** → Analyse.
Say while it runs: *"That's real OCR running in this browser. Nothing is uploaded, and
this works with the wifi off."*
Land on: **No issues found**. Then immediately undercut it —
*"Notice it does not say compliant. It says no issue among the declarations it checked.
That is the only claim our method supports."*

**1:00 — a defective pack.** Back → specimen **Edible oil** → Analyse.
Four findings. Click one. Point at:
- the clause chip — *"Rule 6(1)(c), from the rule pack, not hard-coded"*
- the green box on the label — *"this is the region an officer looks at to agree or disagree"*
- the asterisk — *"this sub-clause letter is disputed. We show both readings. No officer
  has confirmed one, so every finding here is capped at advisory — enforced by data, not
  by us remembering."*

**1:50 — the refusal. This is the moment that wins.** Back → specimen **Shelf photo** → Analyse.
**Insufficient evidence.**

Point at the note above the image first: *"It didn't just give up. Most of that frame was
background, so it located the panel, cropped it, and re-read it from the original at
higher resolution — that took it from 2 declarations to 4."*

Then the verdict: *"And it still refused. Five lines of text against a floor of six. Most
tools would confidently report six missing declarations from a photo like this. We report
that we cannot tell. A false flag costs an officer more than a missed one."*

If a judge asks why it refuses having found four declarations: *"Because four out of six
from five lines of text means we're probably looking at a fragment of a panel, not a
panel. Reporting the other two as missing would be an accusation we can't support."*

**2:20 — the governance screen.** `/rulepack`.
*"Eight declarations, zero verified by a Legal Metrology officer, four with contested
sub-clause letters. No clause number exists anywhere in our source code — a change in the
Rules is a JSON edit with a version and a review status, not a software release."*

**2:45 — close.** `/` Overview.
*"And this is what a controller sees across a district: which declaration is most often
missing, which manufacturer, which jurisdiction. One officer cannot answer that. The
repository behind it is sample data until the backend lands, and the header says so."*

---

## Hard questions, and honest answers

**"Your OCR missed things on a real packet."**
Yes. Show the **Text read from the image** panel. *"Here's exactly what the engine read.
Line 4 is garbage because the pouch is creased through the glyphs. We show you the input
so a wrong value can be told from a wrong rule — most tools show you neither."*

**"So it's not accurate?"**
Separate the halves. *"The rule engine is deterministic and covered by 158 tests. Given
good text it is exactly right, every time. Recognition is the statistical part, and it is
swappable — the interface is already there. On the phone it's ML Kit; here it's Tesseract."*

**"What's the AI?"**
*"Deliberately, the decision layer isn't. Recognition is statistical; the step that turns
what was read into a legal flag is a pure function with no learned parameters, so the same
inputs always give the same verdict and a dispute is reproducible. That's a requirement in
enforcement, not a limitation."*

**"Why is everything advisory?"**
*"Because no Legal Metrology officer has reviewed our rule pack. The cap is in the data,
and a test fails if an unreviewed entry ever emits a violation. The day an officer signs
off, it lifts without a code change."*

**"Does it need internet?"**
*"No. Recognition, the rule pack and the verdict are all on-device. The network is an
enhancement path, never a dependency."*

**"Can it read Hindi?"**
*"Not yet, and it says so rather than failing quietly. That's the next language pack —
the recognition seam already supports adding one."*

### If you demo with the cloud recognition engine

The line to lead with, because it is the whole architecture in one sentence:

> "We separate perception from judgement. A vision model reads the label — that part is
> allowed to be statistical. The step that turns what was read into a legal finding is a
> pure function with no learned parameters, so the same inputs always give the same
> verdict. An enforcement action has to be reproducible; a model's opinion is not."

**"So it's just an API call?"**
*"The recogniser sits behind an interface. On the phone it's ML Kit on-device, in the
browser it's Tesseract, and the cloud model is a third adapter. We swapped the entire
engine during development and nothing downstream changed — that's what the interface is
for."*

**"What about offline? You claimed offline-first."**
*"The Android app reaches a verdict with no network at all, and the browser falls back to
on-device recognition. The cloud model is an enhancement path, never a dependency."*
Switch the engine back to Tesseract and scan a specimen to show it, if there is time.

**"Doesn't the model hallucinate?"**
*"It can, which is exactly why it never decides anything. It returns text and boxes. And
we print the raw text it read on the report — a misreading is visible rather than hidden
behind a confident verdict."*

**"Is sending packaging photos to Google acceptable for a government deployment?"**
*"For a pilot, yes — it's a photo of a retail label, not personal data. For production you
move to a self-hosted model or a vendor under a data-processing agreement. Because the
recogniser is an adapter, that's a configuration change rather than a rewrite."*

**Never call it "our AI model."** It is Google's model behind your interface. The
precision is worth more than the boast, and claiming otherwise is the one thing that could
actually cost you the round.

**Anything you don't know:** say so, and say what would settle it. That reads as
competence in a government-facing panel. Never invent a number.

---

## Rules for the demo

- **Never** promise a live scan of a random packet a judge hands you. Offer it *after* the
  scripted run, framed as *"let's see what it does — it may well refuse, and I'll show you
  why."* Then the refusal is a feature you predicted, not a failure.
- If something breaks, go to `/how` and talk. The page carries the whole argument.
- Do not lower a threshold to make a demo pass. If asked whether you could: *"We could,
  and that's exactly the temptation the design exists to resist."*

---

# Technical deep-dive script

For the Q&A, or a longer slot. Two answers you should be able to give without notes: how
the image becomes text, and where the backend is. Say the numbers — they are all real and
all checkable in the repository.

## A. Image recognition — the 2-minute answer

**Open with the boundary, always.**

> "Recognition is the only part of this system allowed to be statistical. It turns a
> photograph into lines of text with boxes, and then it stops. Everything after it is a
> pure function."

**Then the adapter, because it is the structural point.**

> "The recogniser sits behind one interface, `OcrProvider`. We have three implementations:
> ML Kit running on the Android device, Tesseract compiled to WebAssembly running in the
> browser, and Google Gemini in the cloud. Nothing downstream knows which one ran. We
> proved that by swapping the engine three times during development — extraction,
> evaluation and the report never changed."

**Then what the browser path actually does, because this is the part with real engineering
in it.**

> "In the browser it is a two-pass read. Pass one recognises the whole frame and finds
> where the text is. If the text occupies less than about half the frame — a packet on a
> table is mostly table — we crop to the located panel and re-read that region *from the
> original pixels*, not from the downscaled copy. That is a genuine gain in pixels per
> glyph. Measured on a reproduction: six lines became eleven, and median text height went
> from 17 pixels to 49."

> "We also read at two page-segmentation modes, because neither wins on its own. A single
> printed panel is one uniform block; a snack packet with a nutrition table on the left and
> declarations on the right is two columns. We run both and keep whichever reading located
> more declarations. The decision is made per image, by measurement."

**Then the bug that shows you were paying attention. This one lands well.**

> "Tesseract merged two physically separate parts of a packet into one line — a printed
> 'Manufactured, Packed & Marketed by:' label from the bottom of the pack, joined to
> 'DRINK BASED ON FERMENTED' from the top. Our extractor did the right thing with a wrong
> input and reported a nonsense manufacturer at high confidence. So now every recognised
> line is re-checked against its own word boxes and split wherever neighbouring words
> separate by more than twice their text height. Inside a real line the gaps are about half
> a text height; across that bogus join it was thirteen. Two orders of magnitude apart."

**If they push on accuracy — do not get defensive. Give them the negative results.**

> "Tesseract has a low ceiling on creased, glossy packaging, and we measured that rather
> than guessing. We benchmarked page-segmentation modes, pre-recognition upscaling and
> contrast normalisation on a deliberately degraded label. Contrast normalisation — the
> obvious thing to reach for — actively destroyed the read: zero out of ten target strings,
> against five for doing nothing at all. We also integrated PaddleOCR and removed it. Its
> browser build ships only a Chinese recognition model, which emits no word spaces, and
> every anchor in our rule pack is a spaced English phrase. Fourteen lines detected, zero
> declarations located. That is why the cloud adapter exists."

**Close on the safety property.**

> "And when the reading is not good enough, the tool says so. Frame quality is measured —
> print size as a fraction of frame height, panel coverage, how much text is cut off at the
> border — against thresholds held in the rule pack. Below them no verdict is offered and
> the failed check is named. We also print the raw recognised text on every report, so a
> misreading is visible rather than hidden behind a confident answer."

## B. The backend — the 60-second answer

**Do not bluff this. The backend is not built. Say so first, then say why the order is
right.**

> "The backend is specified and scaffolded, not implemented. That is deliberate sequencing
> rather than an omission, and the architecture is the reason."

> "In most designs the server is the brain: you upload a photo, it runs the model, it
> decides. Ours cannot be built that way, because an inspector works in a shop with poor
> connectivity and a verdict has to be reachable there. So the decision layer — the
> extraction cascade, the frame checks, the rule engine and the rule pack — all run on the
> device. The phone reaches a verdict with the network unplugged."

> "That leaves the backend as a repository rather than a brain: it stores scans, syncs an
> offline queue, aggregates repeat offenders by manufacturer, and holds the audit chain.
> Every one of those is valuable to a controller, and none of them is on the path to a
> verdict. So we built the part that must work offline first, and the part that makes a
> department efficient second."

**What is specified, if they ask for detail.**

> "FastAPI with PostgreSQL. Scans, findings and evidence hashes; verdicts versioned against
> the rule pack that produced them; a materialised view for offender aggregation by GS1
> company prefix; an append-only audit log with a hash chain, so a record cannot be altered
> after the fact; JWT role-based access, so an officer sees their own scans and a controller
> sees a jurisdiction. The schema and the indexes are written down in the implementation
> plan — including a partial index on non-compliant scans, because essentially every
> dashboard query carries that predicate."

**If they ask what the dashboard is showing right now — answer before they catch it.**

> "The scan repository you are looking at is a sample corpus, and the header says *Sample
> repository* the entire time. What is real is the analysis: upload a label and it is
> genuinely read and genuinely evaluated, on this machine."

## Numbers to know cold

| | |
| --- | --- |
| Declarations checked | **8**, across **6** label fields |
| Verified by a Legal Metrology officer | **0** — so every finding is capped at advisory |
| Sub-clause letters contested | **4** — both readings shown, neither chosen |
| Automated tests | **158** |
| Clause numbers in source code | **0** — all of it is rule-pack data |
| Offline recognition payload | **30 MB** vendored, no CDN |
| Frame-quality floors | print >= **1.2%** of frame height, coverage >= **2%**, text at border <= **34%** |
| Evidence floors for a verdict | **6** lines of text, **2** declarations located |

## Three traps

- **Never say "our AI model."** The cloud model is Google's, sitting behind your interface.
  Say "our recognition adapter" and name the engine.
- **Never claim the backend runs.** "Specified and scaffolded" is the true phrase and it
  costs you nothing, because the reason it is not built is a design argument in your favour.
- **Never quote an accuracy percentage.** You do not have a measured one. Say: *"We have
  not measured accuracy against a gold set yet — that is what the eval harness is for. What
  we can show you is every line the engine read, on every report."* An honest gap beats an
  invented figure, and a technical panel will test you on exactly this.

## Before you present

- [ ] `cd dashboard && npm run dev` running, browser open on `/how`, zoom ~110%
- [ ] If demoing the cloud engine: key saved, one scan already run to prove it works,
      phone hotspot ready, and Tesseract known to be one click away as the fallback
- [ ] Hard-reload once (`Ctrl+Shift+R`) — the OCR worker caches
- [ ] Run all three specimens once so the engine is warm
- [ ] Laptop on mains, notifications off, phone on silent
- [ ] Know your three numbers: **8** declarations, **0** verified, **158** tests
