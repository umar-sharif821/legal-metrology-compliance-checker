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

## Before you present

- [ ] `cd dashboard && npm run dev` running, browser open on `/how`, zoom ~110%
- [ ] Hard-reload once (`Ctrl+Shift+R`) — the OCR worker caches
- [ ] Run all three specimens once so the engine is warm
- [ ] Laptop on mains, notifications off, phone on silent
- [ ] Know your three numbers: **8** declarations, **0** verified, **158** tests
