# Contents

~~~t|8,72,20
# | Section | Page
 | **Part I — Review** | 
1 | Executive Summary | 2
2 | Verdict on the v1 Specification | 4
3 | Revised Design Principles | 7
 | **Part II — The System** | 
4 | The Legal Rule Model | 8
5 | System Architecture | 12
6 | The Scan Pipeline, Restructured | 15
7 | The Extraction Engine | 17
8 | Geometry — Measuring Honestly | 20
9 | Identity and Fraud Cross-Check | 22
10 | E-Commerce Batch Mode | 24
 | **Part III — Product Surfaces** | 
11 | Mobile Application — UX | 26
12 | Web Dashboard | 28
13 | Data Model, Offline and Sync | 29
14 | Evidence Integrity, Security and Privacy | 31
 | **Part IV — Quality, Speed, Stack** | 
15 | Evaluation and Quality Gates | 32
16 | Performance Engineering | 34
17 | Final Technology Stack | 36
 | **Part V — Execution** | 
18 | Repository Layout | 38
19 | Build Plan | 39
20 | Risk Register | 41
21 | Demo Script | 42
22 | Differentiator Summary | 44
~~~

# [SECTION 1] Executive Summary

## What v1 got right

The v1 specification has a genuinely good instinct at its centre, and I have kept it: **the verdict must be deterministic, rule-driven, and cite the clause it is enforcing.** For a tool that feeds a legal enforcement process, a black-box confidence score is not merely unhelpful — it is inadmissible. An officer cannot issue a notice on the strength of "the model said 0.82." The category-conditional rule set is likewise the correct differentiator: a flat checklist that demands an expiry date on a notebook will be switched off by its users within a week.

Those two ideas survive intact. Most of the rest of this document is about the machinery underneath them.

## The five things that had to change

::: change 1 — Tight bounding-box crops destroy the evidence the geometry checks need
v1 Layer 5 captures a still "cropped tightly to that bounding box", and v1 Layer 9 then measures **blank space around the net-quantity declaration**. These are mutually exclusive. Cropping tightly to the net-quantity text removes exactly the whitespace Rule 9 asks you to measure. The revised pipeline captures **full-resolution panel frames** and treats tight crops as *evidence thumbnails only*, derived afterwards.
:::

::: change 2 — Per-field cloud OCR calls are the wrong network shape
v1 sends each cropped field independently and in parallel to Cloud Vision. On a rural 4G link that is six to ten TLS handshakes and six to ten uploads per product, and the tail latency of the slowest one sets the verdict time. The revised design sends **one request per captured panel** (typically 1–2 per product), and — more importantly — decouples the verdict from the network entirely via a progressive verdict model.
:::

::: change 3 — The 1.5–3 s latency claim was attached to the wrong thing
v1 measures latency to a single final verdict that depends on a cloud round trip. The revised design produces a **provisional on-device verdict in under a second with zero network**, then upgrades it in place when higher-accuracy OCR returns. The officer is never waiting on a server to learn that the MRP line is missing. This is both faster in practice and honest about what happens when there is no signal — which, in the field, is often.
:::

::: change 4 — "Font height in millimetres" cannot be computed from a photo without a scale reference
v1 proposes "package-dimension inference using detected package edges as implicit scale reference." A package edge tells you nothing about absolute size unless you already know the package's dimensions. The revised design separates two claims that v1 conflated: the **relative** check (Rule 8(2) — MRP height versus net-quantity height) needs no scale at all and is fully reliable; the **absolute** check (Rule 7 — the millimetre floor) requires a real scale reference, for which this plan specifies a concrete ladder of three, in confidence order, and refuses to emit a number when none is available.
:::

::: change 5 — There was no way to know whether the system works
v1 has no dataset, no metrics, and no regression gate. A compliance tool whose accuracy is unmeasured is a demo. The revised plan makes a **labelled gold set and a per-rule precision/recall harness a first-class deliverable of Sprint 2**, wired into CI, with flag precision as the number the team optimises. This is also the single most persuasive artefact you can put in front of a judging panel.
:::

## The four things I added

- **A rule-applicability gate.** Before any rule is evaluated, the system decides whether the package is even within the scope of the Rules — exempted small packages, non-retail/institutional packs, and commodity-specific carve-outs. Flagging an exempt package is a false positive that costs officer trust far more than a miss costs. This makes the "category-conditional" differentiator materially deeper.
- **A layout-aware extraction cascade** replacing bare regex. Regex alone has poor recall on real Indian labels — multi-line, mixed-script, rotated, on curved surfaces. The cascade adds anchor–value spatial association and a synonym lexicon on top of regex, and remains fully deterministic and inspectable.
- **A multi-statute rule pack.** Category-conditionality becomes much more powerful when the category selects a *statute set*, not just a subset of one rule. Food additionally implies FSSAI licence number and the veg/non-veg mark; electronics implies BIS CRS. Shipped as a clearly-separated optional module so the LMPC core remains the headline.
- **Offline queue and sync as a designed feature**, not an afterthought. Field enforcement happens in godowns, basements and markets. Scans queue locally and reconcile later.

## The two things I cut

- **GEPIR as a load-bearing dependency.** The fraud cross-check is v1's most novel idea and it was resting on a rate-limited external registry with uneven Indian coverage. It is retained but demoted to one of four identity signals, and backed by an offline GS1 check-digit and prefix validation that costs nothing and never fails.
- **WeasyPrint.** Its GTK dependency chain is painful on Windows, which is the team's development platform. Report rendering moves to headless Chromium, which is already in the stack for e-commerce scraping.

## What this document is

Sections 2–3 are the review and the revised principles. Sections 4–10 are the system: the rule model, architecture, pipeline, extraction, geometry, identity, and e-commerce mode. Sections 11–14 are the product surfaces and the data. Sections 15–17 are how you know it works and how fast it is. Sections 18–22 are the build: repository layout, sprint plan with explicit cut lines, risks, and the demo.

Where a claim depends on the exact text of a statute, it is marked **LEGAL REVIEW** and must be checked against the bare Act before the demo. This is not hedging — rule identifiers are stored as data precisely so that correcting them is a JSON edit rather than a code change.

# [SECTION 2] Verdict on the v1 Specification

This section is the line-by-line review. Every item in v1 is classified as **Keep**, **Change**, **Add** or **Cut**, with the reason. Nothing from v1 is discarded silently.

## 2.1 Design principles

~~~t|30,14,56
v1 position | Verdict | Reasoning
Deterministic, rule-based, explainable; no trained models | **Keep** | Correct for the domain. An enforcement verdict must be reproducible and attributable to a clause. Also removes the entire training-data burden, which is the right call under hackathon time pressure.
"No ML anywhere" as an absolute | **Change** | The principle you actually want is *no black-box verdicts*. Pretrained detectors used as-is are fine — v1 already relies on ML Kit, which is a neural model. State the principle as **"the decision layer is deterministic"** so the position is defensible when a judge points out that ML Kit is a CNN.
Every verdict cites the exact rule | **Keep** | This is the strongest thing in the document. Extend it: cite the rule *version* too (see §4.5).
Confidence-banded, never binary | **Keep** | Correct, and rare. Keep the honest framing in the UI ("3 issues found", not "FAIL").
~~~

## 2.2 The rule system

~~~t|30,14,56
v1 position | Verdict | Reasoning
Rule 6 mandatory declarations | **Keep, expand** | The six listed are the core. Missing: country of origin for imports, unit sale price for multi-piece packs, and the language requirement. See §4.2.
Sub-clause letters as written in v1 | **Change** | v1 maps MRP to 6(1)(f), date to 6(1)(g), consumer care to 6(1)(h). Widely-cited readings of the 2011 Rules place net quantity at 6(1)(c), month/year at 6(1)(d), retail sale price at 6(1)(e) and consumer care at 6(1)(f). **This must be resolved against the bare Act.** Getting a citation wrong is worse than omitting it — it is the one error a Legal Metrology judge will certainly catch.
Best-before is Rule 6(1)(e), food only | **Change** | The conditionality is right; the attribution is doubtful. Date-of-expiry labelling for food is principally an **FSSAI Labelling & Display Regulations, 2020** obligation. Citing LMPC for it invites a correction from the panel. Handle via the multi-statute pack (§4.4).
Font size: 4 mm flat / 6 mm embossed | **Change** | The Rules set minimum height **as a function of the area of the principal display panel** — a table, not a single constant. Encoding the actual table is more accurate, and demonstrates you read the schedule rather than a blog summary. See §4.3.
Rule 8(2) MRP/net-qty font parity | **Keep — promote** | This is the best geometry check in the document because it needs no scale reference. Promote it from a secondary check to the **primary** font-related finding.
Rule 9 spacing, 1x/2x numeral height | **Keep** | Sound, and computable — but only on uncropped frames. See Change 1.
Co-location / principal display panel | **Keep, soften** | Real, but hard to assert confidently from freeze-frames that may span panels. Emit as advisory-band unless a single frame contains all declarations.
Category system with 6 categories | **Keep, expand** | Add `pharma`, `household_chemical` and `imported` as an orthogonal flag rather than a category. See §4.6.
Category from GS1/GPC, fallback keywords | **Change** | GPC classification is not reliably available from free GEPIR responses. Invert the priority: **keyword/lexicon classification is the primary path**, barcode-derived category is a corroborating signal when present.
~~~

## 2.3 The pipeline

~~~t|30,14,56
v1 layer | Verdict | Reasoning
L0 camera opens directly, no shutter | **Keep** | Right instinct. Removing the capture step is a real usability win.
L1 barcode via ML Kit | **Keep** | Correct tool, on-device, fast.
L2 GEPIR lookup | **Change** | Retain, demote. Add offline check-digit and GS1 prefix validation first — those are instant, free and never unavailable. §9.
L3 live continuous OCR + blur gate | **Keep, extend** | Blur gating via Laplacian variance is the right idea. Add **glare/specular detection** — on glossy Indian packaging, blown-out highlights defeat OCR more often than motion blur does. §7.5.
L4 loose regex candidate matching | **Change** | Regex-only has poor recall on real labels. Replace with the extraction cascade in §7 — regex remains stage one of three.
L5 freeze-frame per candidate, tight crop | **Cut and replace** | Breaks the geometry checks (Change 1) and produces too many network calls (Change 2). Replace with **panel-level full-resolution capture**.
L6 per-field parallel cloud OCR | **Change** | One request per panel, not per field. Fire-and-forget is correct; the granularity was not.
L7 strict re-validation, discard rough text | **Keep** | Genuinely good design. Two-tier "rough finds, accurate confirms" is sound, and discarding the rough text is disciplined.
L8 category-conditional validation | **Keep, gate** | Insert the **applicability gate** in front of it (§4.1) so exempt packages are never evaluated at all.
L9 geometry / font size | **Change** | Split into scale-free (reliable) and scale-dependent (requires a reference). §8.
L10 barcode cross-validation | **Keep, strengthen** | Best novel idea in v1. Make it a four-signal identity check. §9.
L11 confidence-scored verdict JSON | **Keep** | Good shape. Add rule-pack version, applicability trace and evidence hashes to the envelope.
L12 display to officer | **Change** | Becomes *progressive* display: provisional verdict at <1 s, refined in place. §6.
L13 async repository write | **Keep** | Correct — off the fast path.
L14 repeat-offender detection | **Keep, improve** | Key on **GS1 company prefix** as well as GTIN so a brand's thousands of GTINs aggregate to one offender. §9.4.
L15 on-demand report | **Keep** | Correct to keep off the latency budget. Change the renderer (§17).
L16 dashboard | **Keep** | Scope is right.
E-commerce batch mode | **Change, expand** | v1 only OCRs listing images. Most listing declarations are in **HTML text**, which is free to check and far more reliable. Check both. §10.
~~~

## 2.4 Non-functional and stack

~~~t|30,14,56
v1 position | Verdict | Reasoning
1.5–3 s typical, <5 s worst | **Change** | Re-baseline against the progressive model: **provisional <1 s on-device**, refined verdict <3 s on a good link, and a stated graceful path when there is no link at all.
Fully offline capable | **Keep — but v1 does not deliver it** | v1 puts the rule engine in FastAPI. If the server is unreachable there is no verdict. Offline capability requires the **rule engine to run on the device**. This is the single largest architectural gap in v1 and is addressed in §5.2.
PaddleOCR as offline fallback "runs locally" | **Change** | Ambiguous, and PaddleOCR on-device in React Native is not realistic in the time available. Define three explicit execution modes (§5.1): device-only, self-hosted edge, cloud.
Hindi + English | **Keep, bound honestly** | ML Kit covers Latin and Devanagari on-device. Tamil, Telugu, Bengali, Kannada and Gujarati are **not** available on-device and need the server path. Say so rather than implying pan-Indian on-device coverage.
Evidence "hash-timestamped" | **Change** | Too thin for a legal artefact. Upgrade to a signed, append-only hash chain. §14.
WeasyPrint | **Cut** | GTK dependency chain on Windows will cost the team hours. Headless Chromium is already required for scraping.
PostgreSQL | **Keep, extend** | Add `pg_trgm` for fuzzy manufacturer matching in the database rather than in Python.
Render / Railway / Vercel | **Keep** | Fine for a demo. Add a single-command Docker Compose path so the whole system can be shown with no internet at all — which is a real possibility on a demo floor.
~~~

::: note On the differentiator list
v1's eight differentiators are mostly sound. The two that will not survive a technical challenge as written are **#7 "honest font-size estimation"** (honest, but v1's method does not work — fix per §8) and **#3 "barcode fraud cross-check"** (excellent, but not demonstrable if GEPIR is down — fix per §9). Both become stronger, not weaker, after the changes in this document.
:::

# [SECTION 3] Revised Design Principles

These nine principles are the tiebreakers. When two implementation options are equally plausible, the one that better satisfies a higher-numbered principle loses to the one that satisfies a lower-numbered one.

### P1 — The decision layer is deterministic and cites its authority

Perception may be statistical; judgement may not. OCR, barcode decoding and blur estimation are allowed to be neural or heuristic. The step that converts extracted facts into a flag is a pure function of `(extracted_fields, geometry, category, rule_pack)` with no learned parameters, and every flag it emits carries a statute, a rule identifier, a sub-clause, and the rule-pack version that produced it.

### P2 — A useful answer with no network beats a perfect answer with one

The device must reach a provisional verdict alone. Network access is an *enhancement path*, never a dependency. This principle is what makes the tool usable in a market basement, and it is also what makes it fast.

### P3 — A false flag costs more than a missed flag

An officer who is sent to inspect three compliant packages stops trusting the tool, and an untrusted tool is uninstalled. A missed violation is a missed violation. Therefore: **precision on flags is the primary metric**, recall is secondary, and any uncertain finding is emitted as an advisory rather than a flag.

### P4 — Never emit a number the method cannot support

If a millimetre measurement has no scale reference, the system says "scale reference unavailable — measure manually" and offers the on-screen ruler tool. It does not interpolate. This is a differentiator precisely because it is a restraint.

### P5 — Applicability before evaluation

The first question is never "does this package comply?" It is "do these Rules apply to this package?" Exemptions are checked first and recorded in the verdict envelope even when the answer is "yes, in scope."

### P6 — Rules are data, code is an interpreter

Every statutory fact — clause numbers, thresholds, unit tables, keyword lexicons, exemption predicates — lives in a versioned, schema-validated JSON rule pack. Correcting a misremembered sub-clause is a data edit reviewable by a domain expert who does not read Python. This also makes the rule pack the artefact you hand to a Legal Metrology officer for validation.

### P7 — Evidence is captured for a human, not just for a machine

Every flag carries the image region a person can look at to agree or disagree. The system's job is to direct attention, not to replace judgement.

### P8 — Measure what you claim

Latency claims are backed by a per-stage histogram emitted in every build. Accuracy claims are backed by a gold set and a CI gate. Any number in the pitch deck traces to a command that prints it.

### P9 — Degrade visibly, never silently

If Devanagari OCR is unavailable, the UI says so. If GEPIR times out, the identity panel says "registry unreachable", not "no mismatch found". Silent degradation in an enforcement tool is a correctness bug.

# [SECTION 4] The Legal Rule Model

## 4.1 The applicability gate — new, and evaluated first

Before any declaration is checked, the package is tested against a scope predicate. Three outcomes are possible: **in scope**, **exempt** (with the exempting provision cited), or **indeterminate** (the officer is asked one disambiguating question).

~~~t|26,40,34
Gate | Test | Consequence
Is it pre-packaged? | Was the commodity packed without the purchaser being present, in a predetermined quantity? Loose/weighed-at-counter goods are outside the Rules. | Officer-confirmable toggle; defaults to "pre-packaged" for barcoded items.
Retail or institutional? | Packages marked for institutional or industrial consumers carry a reduced declaration set. Detect the phrases "not for retail sale", "for institutional use", "industrial consumer". | Switches to the reduced rule subset rather than flagging missing retail declarations.
Small-quantity exemption | Very small packages (commonly cited thresholds: 10 g / 10 ml, with commodity-specific carve-outs) are exempt from parts of Rule 6. **LEGAL REVIEW** | Suppresses the affected declaration checks and records the exemption in the envelope.
Multi-piece / combination pack | A multi-piece package has its own declaration obligations, including per-unit information. | Activates the multi-piece rule subset.
Imported package | Presence of importer details, "Imported by", or a non-890 GS1 prefix. | Activates country-of-origin and importer-address obligations.
Commodity-specific schedule | Certain commodities must be packed only in prescribed standard quantities. | Activates the standard-pack-size check for those commodities only.
~~~

::: why
Every competing tool in this space runs a flat checklist. The applicability gate is the cheapest possible way to be visibly better than them, because it removes the failure mode that field users complain about first: being told a 5 g sachet is missing four declarations it was never required to carry. It also gives you a very strong demo beat — scan an exempt item, and instead of a wall of red the officer sees *"Outside the scope of Rule 6 — small-quantity exemption. No action required."*
:::

## 4.2 Universal declarations (Rule 6)

Encoded in `rulepack/lmpc-2011.json`. Sub-clause identifiers below reflect the commonly-cited reading of the 2011 Rules and **differ from v1**; both must be reconciled against the bare Act before demo.

~~~t|20,26,32,22
Field | Rule (LEGAL REVIEW) | What is checked | Confidence
Manufacturer / packer / importer name and address | 6(1)(a) | Presence; address must include a locality and a 6-digit PIN-like token; "Marketed by" alone does not satisfy it | High
Common or generic name of commodity | 6(1)(b) | Presence of a commodity noun from the lexicon, distinct from the brand name | Medium
Net quantity in standard units | 6(1)(c) | Presence; SI unit legality; symbol case (`g` not `gms`, `ml` not `ML`); numeral formatting | High
Month and year of manufacture / packing / import | 6(1)(d) | Presence; parseable to a month-year; not in the future; plausible age | High
Retail sale price | 6(1)(e) | Presence; currency token; **must carry the "inclusive of all taxes" wording**; single unambiguous price | High
Consumer care details | 6(1)(f) | Presence of a name/designation plus at least one of: phone, email, or address for complaints | Medium
Country of origin | Import-conditional | Required for imported packages; also a common e-commerce listing violation | High
Unit sale price | Multi-piece-conditional | Required where a package contains individually saleable units | Medium
Language of declarations | 6(3)-family | Declarations must appear in Hindi (Devanagari) or English | Medium
~~~

### The MRP sub-checks — worth building carefully

The MRP declaration is where most real violations concentrate and where the tool can be most precise, because the failure modes are textual and deterministic:

- **Missing tax wording.** `₹120` alone is non-compliant; the phrase "inclusive of all taxes" (or an accepted Hindi equivalent) must accompany it. Match a normalised phrase set, tolerant of OCR noise, abbreviation ("incl. of all taxes") and line wrapping.
- **Dual or contradictory prices.** Two different MRP values on one package, or an MRP alongside a struck-through higher price, is a distinct and serious finding.
- **Price without the "Maximum Retail Price" label**, or labelled only as "Price" / "Rate".
- **Per-unit price arithmetic.** For multi-piece packs, check that the declared unit price times the unit count reconciles with the pack MRP. This is a pure arithmetic check with zero false-positive risk when both numbers parse — and it looks impressive because no competitor does it.

## 4.3 Font size and legibility (Rules 7, 8 and the schedule tables)

::: change v1's "4 mm flat / 6 mm embossed" is an oversimplification
The Rules set the minimum height of numerals and letters **as a function of the area of the principal display panel** — larger panel, larger required minimum — with a separate, higher floor for embossed, moulded, blown or perforated print. Encode the actual table. It is a dozen rows of JSON, it is more accurate, and it signals to a Legal Metrology judge that you read the schedule.
:::

The rule pack therefore stores a lookup rather than a constant:

```
"rule_7_height_table": {
  "unit": "mm",
  "basis": "area_of_principal_display_panel_cm2",
  "bands": [
    {"max_area_cm2": 100,  "min_height_normal": 1.0, "min_height_embossed": 2.0},
    {"max_area_cm2": 300,  "min_height_normal": 2.0, "min_height_embossed": 4.0},
    {"max_area_cm2": 500,  "min_height_normal": 4.0, "min_height_embossed": 6.0},
    {"max_area_cm2": null, "min_height_normal": 6.0, "min_height_embossed": 6.0}
  ],
  "source": "LMPC 2011, Rule 7 read with the Second Schedule",
  "status": "PENDING_LEGAL_REVIEW",
  "reviewed_by": null, "reviewed_on": null
}
```

Every numeric table in the pack carries the same `source` / `status` / `reviewed_by` triple. Unreviewed tables produce advisories, never flags — so an unverified threshold can never generate a wrong accusation. That is P1 and P3 working together, and it is also a clean answer if a judge asks "how do you know your thresholds are right?"

### Rule 8(2) — font-size parity, promoted to primary

The requirement that the MRP declaration's numeral height match that of the net-quantity declaration is **the most valuable geometry check in the entire system**, because it is a *ratio* and therefore needs no scale reference whatsoever. Two bounding boxes from the same frame, same camera, same distance: the comparison is exact up to OCR box tightness. This should be the font-related finding you lead with in the demo.

## 4.4 Optional extended pack — multi-statute checks

Category-conditionality becomes far more powerful if the category selects a **statute set** rather than a subset of one rule. Ship this as `rulepack/extended-*.json`, clearly separated and individually switchable, so the LMPC core remains the headline and nothing here can be mistaken for the primary claim.

~~~t|18,26,38,18
Category | Statute | Additional deterministic checks | Effort
food | FSSAI Labelling & Display Regulations, 2020 | 14-digit FSSAI licence number present and structurally valid; veg (green) / non-veg (brown) mark present; "best before" / "use by" date present and parseable; date not already past | Medium
electronics | BIS CRS / e-waste rules | BIS registration number in `R-XXXXXXXX` form; standard mark; e-waste symbol | Low
cosmetics | Drugs & Cosmetics Rules | Manufacturing licence number; batch number; net content; date of manufacture and expiry | Low
pharma | Drugs & Cosmetics Rules | Batch number; manufacturing and expiry dates; "Schedule H / H1" warning box where applicable | Medium
household_chemical | Hazard labelling | Hazard pictogram presence; safety directions text block | Low
~~~

### The veg / non-veg mark — a genuinely nice deterministic CV win

The mark is a filled circle inside a square outline, green for vegetarian and brown/red for non-vegetarian, with a specified minimum size. It is detectable with classical computer vision and no model at all: HSV threshold for the two colour ranges, contour extraction, then filter on circularity, on the presence of an enclosing quadrilateral, and on the ratio between the two. It runs in a few milliseconds, it is fully explainable, it demos beautifully, and its absence on a packaged food item is a real and common violation.

## 4.5 Rule-pack versioning and the verdict envelope

Statutes are amended. A verdict issued in March under one threshold must remain explicable in September under another. Every rule pack carries a semantic version and a content hash; every stored verdict records both.

```
{
  "schema_version": "2.0",
  "rulepack": {"id": "lmpc-2011", "version": "1.4.2",
               "sha256": "9f2c…", "amendments_through": "2022-11-01"},
  "applicability": {
    "in_scope": true,
    "gates_evaluated": ["pre_packaged", "retail", "small_quantity", "import"],
    "exemptions_applied": [],
    "package_type": "single_unit_retail"
  },
  "category": {"value": "food", "source": "lexicon",
               "corroborated_by": "gs1_prefix", "confidence": "high"},
  "identity": {
    "gtin": "8901030895556", "check_digit_valid": true,
    "gs1_prefix_region": "IN", "registry_lookup": "unavailable",
    "ocr_manufacturer": "Hindustan Unilever Ltd",
    "identity_match": "not_verified"
  },
  "findings": [
    {"id": "f1", "severity": "violation", "statute": "LMPC-2011",
     "rule": "6(1)(e)", "title": "MRP lacks 'inclusive of all taxes' wording",
     "detail": "Found 'M.R.P. ₹120.00' with no tax-inclusivity phrase within the declaration block.",
     "confidence": "high", "evidence": ["ev_3"], "extraction_stage": "strict"},
    {"id": "f2", "severity": "advisory", "statute": "LMPC-2011",
     "rule": "7", "title": "Numeral height may be below the minimum",
     "detail": "No scale reference was available; relative check only. Recommend manual measurement.",
     "confidence": "low", "evidence": ["ev_1"], "measurement": null}
  ],
  "verdict": "NON_COMPLIANT",
  "verdict_stage": "refined",
  "timings_ms": {"provisional": 780, "refined": 2410}
}
```

Note `severity` separating **violation** from **advisory**, and `measurement: null` where P4 forbids a number. Note also `verdict_stage`, which tells the UI whether it is showing the on-device provisional answer or the refined one.

## 4.6 Category resolution — priority inverted from v1

v1 makes the GS1/GPC classification primary and keywords the fallback. Free GEPIR responses do not reliably carry GPC classification for Indian GTINs, so in practice v1's primary path would almost always fail through to the fallback. The revised order:

1. **Lexicon classifier over confirmed OCR text (primary).** A weighted keyword table per category, scored, with a margin requirement — the top category must beat the runner-up by a set margin or the result is `generic`. Deterministic, offline, instant, and tunable against the gold set.
2. **GS1 prefix and registry classification (corroborating).** When present and in agreement, raises confidence to high. When present and in *disagreement*, this is itself worth surfacing.
3. **Officer override (authoritative).** A one-tap category chip in the scan UI. The officer is the domain expert; let them correct the machine in one gesture, and record that they did — that correction is training data for your lexicon and a metric for your eval harness.

Categories: `food`, `cosmetics`, `pharma`, `electronics`, `stationery`, `textile`, `household_chemical`, `generic`. `imported` is an **orthogonal flag**, not a category, because an imported food package needs both rule sets.

# [SECTION 5] System Architecture

## 5.1 Three execution modes, named explicitly

v1 says "fully offline capable" and "PaddleOCR runs locally" without stating *where* local is. That ambiguity hides the biggest hole in the design. Three modes, each fully specified:

~~~t|18,26,28,28
Mode | Where OCR runs | Where rules run | When it is used
**Device** | ML Kit on-device (Latin + Devanagari) | On-device rule engine | Always. This is the provisional path and the only path when there is no connectivity.
**Edge** | PaddleOCR on a self-hosted server on the same LAN or a laptop hotspot | Server rule engine | Enforcement drives with a team laptop; demo floors with no internet. Also the privacy-preserving deployment for a state department.
**Cloud** | Google Cloud Vision | Server rule engine | Default when connectivity is good. Highest accuracy, widest script coverage.
~~~

Modes are not exclusive — Device always runs, and Edge or Cloud *refines* its result when reachable. The officer sees a small mode indicator and can pin a mode manually (an officer in a sensitive inspection may not want images leaving the device at all, and that must be a one-tap setting).

::: change PaddleOCR is a server component, not a phone component
Running PaddleOCR inside React Native would require a bespoke native module and an ONNX/NCNN runtime — days of work with a high chance of failure, for a capability ML Kit already provides on-device. PaddleOCR earns its place on the **server** as the offline-capable, self-hostable alternative to Cloud Vision, which is what a government deployment will actually require.
:::

## 5.2 The shared rule core — the fix for v1's offline gap

If the rule engine only exists in FastAPI, then "offline mode" produces no verdict at all. The rule engine must run in both places, and the two implementations must be provably identical.

~~~t|22,78
Component | Design
`rulepack/*.json` | Single source of truth. Schema-validated, versioned, content-hashed. Contains all clause identifiers, thresholds, tables, lexicons and exemption predicates. Neither runtime hard-codes any statutory fact.
Evaluator, TypeScript | Runs inside the React Native app. Pure function, no I/O, no platform APIs. Ships in the bundle with the rule pack.
Evaluator, Python | Runs inside FastAPI for the Edge and Cloud paths, and for e-commerce batch mode.
**Conformance suite** | ~200 frozen `(input.json → expected_verdict.json)` fixtures. **Both** evaluators run the identical suite in CI. Any divergence fails the build. This is what makes "the same rules run in both places" a fact rather than an intention.
~~~

The alternative — write it once and compile to WebAssembly — is more elegant and more expensive. Two thin evaluators over shared data, held together by a conformance suite, is the correct trade at this scale. The evaluator is a few hundred lines; the rule pack is where the complexity lives, and it is written once.

## 5.3 Component diagram

```
 MOBILE  (React Native)
 ───────────────────────────────────────────────────────────────────
 VisionCamera  ->  frame processor (worklet, ~8 fps)
                     |-- ML Kit barcode    ->  GTIN + check digit (offline)
                     |-- blur + glare gate ->  accept / reject frame
                     `-- ML Kit text v2    ->  rough text + boxes
                                                    |
                                    extraction cascade (TS)
                                                    |
                        .---------------------------+------------------.
                        |                                              |
                rule evaluator (TS)                        panel capture (full-res)
                        |                                              |
              PROVISIONAL VERDICT                          upload outbox (SQLite,
              < 1 s, no network                            resumable, idempotent)
                                                                       |
                                                        (when reachable)
                                                                       v
 BACKEND  (FastAPI)
 ───────────────────────────────────────────────────────────────────
 POST /v1/scan  ->  OCR adapter  ->  Cloud Vision  |  PaddleOCR
                                          |
                          extraction cascade (Py)  ->  geometry (OpenCV/numpy)
                                          |
                          rule evaluator (Py)  ->  identity checks
                                          |
                                 REFINED VERDICT
                                          |
        .---------------+-----------------+-----------------.
        |               |                 |                 |
   PostgreSQL      object store     audit hash-chain    arq worker
   (+ pg_trgm)     (R2 / MinIO)      (append-only)    (batch, reports)
                                          |
                                          v
 WEB DASHBOARD  (React + Vite + Tailwind)
 ───────────────────────────────────────────────────────────────────
```

## 5.4 API surface

~~~t|28,16,56
Endpoint | Method | Purpose
`/v1/scan` | POST | Multipart: panel images + the device's provisional verdict + client metadata. Returns the refined verdict. Idempotent on `client_scan_id` so a retried upload never double-writes.
`/v1/scan/{id}` | GET | Full verdict, evidence URLs, audit record.
`/v1/scans` | GET | Filtered, paginated history. Filters: date, category, officer, verdict, GTIN, manufacturer (trigram fuzzy), region.
`/v1/identity/{gtin}` | GET | Cached GTIN identity: check digit, prefix region, registry record if ever fetched, prior-scan consensus.
`/v1/offenders` | GET | Aggregated by GS1 company prefix and by GTIN, with counts, locations and date ranges.
`/v1/batch` | POST | Submit URLs or a CSV for e-commerce sweep; returns a job id.
`/v1/batch/{job}` | GET | Per-URL progress and results; server-sent events for live progress.
`/v1/report/{scan_id}` | POST | Render PDF/DOCX on demand. Returns a signed, expiring URL.
`/v1/rulepack` | GET | Current pack, version and hash — lets the app check whether its bundled pack is stale and pull an update without an app-store release.
`/v1/feedback` | POST | Officer marks a finding correct or incorrect. Feeds the eval set. §15.3.
~~~

::: add Rule-pack hot update
Because rules are data, `/v1/rulepack` lets you correct a clause number or threshold in production without shipping a new build. For a government tool whose governing rules are amended by notification, this is not a nicety — it is the difference between a tool that stays correct and one that silently rots. It is also a strong answer to "how would this be maintained after the hackathon?"
:::

# [SECTION 6] The Scan Pipeline, Restructured

## 6.1 The progressive verdict model

This is the central change. v1 has one verdict that arrives after the network returns. The revised pipeline has **three states the officer moves through**, and the first one arrives with no network at all.

~~~t|16,18,30,36
Stage | Target latency | Produced by | What the officer sees
**Live** | continuous | On-device OCR + cascade, per frame | The running checklist filling in — each field `searching → found, verifying → confirmed`. Green boxes on detected regions.
**Provisional** | < 1 s from "Done" | On-device evaluator over confirmed fields | A complete verdict with findings and citations, marked *provisional*. Fully usable. Exportable.
**Refined** | < 3 s when online | Server OCR + geometry + identity | The same verdict, upgraded in place: advisories may resolve into violations or disappear, geometry findings appear, identity check completes.
~~~

The refined stage can *only* add information or raise confidence — it never silently contradicts the provisional verdict without showing what changed. If a provisional violation is withdrawn, the UI says so explicitly ("1 finding resolved after high-accuracy re-read"). Silent mutation of a legal finding would be a serious trust bug.

## 6.2 Stage-by-stage

### S0 — Camera opens directly into scanning

No shutter button. `react-native-vision-camera` v4 with a frame processor running in a worklet on a background thread so the preview never drops frames. Torch auto-suggested in low light.

### S1 — Frame admission: blur and glare

Runs first, on a downscaled greyscale copy, and rejects bad frames before any OCR cost is paid.

- **Blur** — variance of the Laplacian, with the threshold auto-calibrated from a rolling window of the session's own frames rather than a hard-coded constant, because absolute sharpness varies enormously between phone sensors.
- **Glare** — fraction of pixels above a high luminance threshold that also form a connected region larger than a minimum area. This is the check v1 omits and it matters more than blur on the glossy metallised film that most Indian snack and cosmetic packaging uses.
- **Coverage** — is the package edge inside the frame? Detected by contour extraction on a downscaled image. Drives the "move back" coaching hint.

Each rejection maps to a specific on-screen hint (§11.3). This loop — reject, explain, correct — is the highest-leverage accuracy work in the entire project, because a good frame makes every downstream stage easier and no downstream cleverness recovers a bad one.

### S2 — Barcode, decoded and validated offline

ML Kit decodes EAN-13/UPC/ITF-14. Then, with no network:

- **Check-digit validation.** The GS1 modulo-10 check digit is arithmetic. An invalid check digit means a fabricated or misprinted barcode — a real fraud signal, computed in microseconds, and something v1 misses entirely.
- **Prefix region.** GS1 prefix `890` indicates GS1 India allocation. A package claiming "Made in India" with a foreign prefix, or an import with no country-of-origin declaration, is a legitimate finding.
- **Length and symbology sanity** for the declared commodity type.

### S3 — Live OCR and the extraction cascade

ML Kit Text Recognition v2 with the Latin and Devanagari models bundled. Output feeds the cascade in §7. Fields transition through `searching → candidate → confirmed`, and only `confirmed` fields reach the evaluator.

### S4 — Panel capture (replaces v1's per-field crop)

::: cut v1 Layer 5 is replaced here
When the field set for a panel stabilises — no new confirmed fields for N frames and the frame passes the admission gate — capture **one full-resolution still of the entire panel**. Typical product: one or two panels. The tight per-field crops v1 wanted are then *derived* from this still for use as evidence thumbnails, so nothing is lost, and the surrounding whitespace that Rule 9 requires is preserved.
:::

The UI then coaches an explicit second capture: *"Front panel captured. Rotate to the back panel."* Multi-panel scanning was one of v1's differentiators; making it a guided step rather than an emergent accident is what makes it reliable.

### S5 — On-device evaluation → PROVISIONAL VERDICT

The TypeScript evaluator runs the applicability gate, then the active rule set, over the confirmed fields. Scale-free geometry (Rule 8(2) ratio, co-location clustering) runs here too — it needs only bounding boxes, which are already in hand. Verdict rendered. **No network has been touched.**

### S6 — Upload and refinement

The panel stills plus the provisional verdict go into a persistent SQLite queue and upload when reachable — resumable, idempotent on `client_scan_id`, and durable across app restarts. The server re-reads the panels at higher accuracy, runs scale-dependent geometry and the identity checks, and returns the refined verdict, which the app merges into the open view or, if the officer has moved on, into their history.

### S7 — Storage, audit and repeat-offender lookup

Async on the server. Evidence to object storage, verdict to Postgres, audit entry appended to the hash chain (§14.2), repeat-offender query by GTIN and GS1 company prefix. None of this is on the officer's critical path.

## 6.3 What the officer waits for, and what they do not

~~~t|40,20,40
Activity | Officer waits? | Notes
Barcode decode + offline validation | No | Completes during live scanning
Field detection and confirmation | No | Live, incremental
Applicability gate + rule evaluation | **Yes, < 1 s** | The only true wait in the system
High-accuracy re-read | No | Refines in background; officer may already be scanning the next item
Geometry (scale-dependent) | No | Arrives with refinement
Identity / registry lookup | No | Arrives with refinement; degrades visibly if unreachable
Repository write, audit chain | No | Fully async
Repeat-offender query | No | Banner appears when it lands
Report generation | On demand only | Never on the scan path
~~~

# [SECTION 7] The Extraction Engine

This section is the accuracy core of the project. v1 says "regex" and moves on; in practice bare regex over raw OCR output is where a label-checking tool quietly fails. Real Indian package labels are multi-line, mixed-script, rotated, printed on curved and reflective surfaces, and routinely separate a field's label from its value by whitespace that OCR renders as a line break.

## 7.1 The problem with regex alone

A pattern like `MRP\s*:?\s*(?:Rs\.?|₹)\s*([\d,]+\.?\d*)` fails on all of the following, each of which is common:

- `M.R.P.` on one line, `₹ 120.00` on the next — OCR emits two text blocks with no adjacency information the regex can use.
- `अधिकतम खुदरा मूल्य` with the value in Latin numerals.
- `MAP` / `MRR` / `M R P` — OCR noise on small or low-contrast print.
- The value to the *right* of the label in a two-column layout, interleaved by OCR's reading order with an unrelated column.
- `₹` misread as `?`, `2`, or dropped entirely.

## 7.2 The cascade — three deterministic stages

Each field is resolved by trying three strategies in order and taking the first that produces a result above its own confidence floor. All three are deterministic and inspectable; the verdict records which stage produced each field.

### Stage A — Direct pattern match (highest precision)

The v1 approach, kept as the fast path. A tight regex over a single normalised text block. When it hits, confidence is high and the other stages are skipped. This resolves the majority of well-printed labels at near-zero cost.

### Stage B — Anchor–value spatial association (the important addition)

This is what makes the difference on real labels.

1. Find an **anchor**: a token matching the field's synonym lexicon (`MRP`, `M.R.P.`, `Max Retail Price`, `अधिकतम खुदरा मूल्य`, `मू.`, …), matched with normalised edit distance so OCR noise is tolerated.
2. Search a **directional neighbourhood** of that anchor's bounding box for a token matching the field's value shape — to the right within a bounded horizontal distance and vertical overlap, or below within a bounded vertical distance and horizontal overlap. Distances are expressed in multiples of the anchor's own text height, so they scale automatically with camera distance.
3. Score candidates by geometric plausibility (proximity, alignment, reading-order consistency) and value-shape strength.
4. Accept the best candidate if it clears the margin over the runner-up.

The same machinery serves every field. Only the lexicon and the value-shape pattern change — both of which live in the rule pack, not in code.

### Stage C — Shape-only recovery (lowest confidence, advisory only)

If no anchor is found, look for an unclaimed token whose *shape* is unambiguous for exactly one field — a currency-prefixed decimal, a `MM/YYYY` token, a quantity-with-SI-unit token. Findings derived solely from Stage C are emitted as **advisories, never violations** (P3). A missing anchor is at least as likely to mean "the OCR missed the label" as "the label is absent", and accusing a manufacturer on that basis is exactly the false positive that destroys trust.

::: why
Stage B is perhaps two hundred lines of code and it is the single largest accuracy improvement available to this project. It is also very demonstrable: put a label with `M.R.P.` on one line and the price on the next in front of the panel, show the regex-only branch missing it and the cascade catching it, with the association drawn on screen. That is a concrete, technical differentiator that a judge can see working.
:::

## 7.3 Text normalisation — done once, before everything

A shared normalisation pass, identical in both evaluator implementations and covered by the conformance suite:

~~~t|30,70
Transform | Rationale
Unicode NFKC + confusable folding | `₹`/`R`/`Rs`, `О`(Cyrillic)/`O`, full-width forms
Digit unification | Devanagari `१२३` → `123`, retaining the original for evidence display
Whitespace and punctuation collapse | `M . R . P .` → `M.R.P.`; `M R P` → `MRP`
Unit canonicalisation | `gms`, `Gm`, `GM`, `gram`, `ग्राम` → `g` — **while recording the original**, because using a non-standard symbol is itself a finding
Currency canonicalisation | `Rs.`, `Rs`, `INR`, `₹`, and common OCR corruptions → `INR`
Line-break repair | Merge OCR blocks whose bounding boxes are vertically adjacent and horizontally aligned within a tolerance
~~~

::: note Normalise for matching, preserve for evidence
Every normalised token keeps a pointer to its original text and bounding box. The officer must always see what was actually printed, not what the normaliser decided it meant. A finding that says "unit declared as 'gms'; SI symbol is 'g'" is only credible if you can show the original pixels.
:::

## 7.4 Field-by-field extraction specification

~~~t|18,30,32,20
Field | Anchor lexicon (abridged) | Value shape | Notes
MRP | MRP, M.R.P., Max Retail Price, Maximum Retail Price, अधिकतम खुदरा मूल्य | Currency token + decimal, optional thousands separator | Tax-inclusivity phrase searched within a bounded neighbourhood of the value
Net quantity | Net Wt, Net Weight, Net Qty, Net Content, शुद्ध वजन, मात्रा | Number + SI unit from the legal unit set | Non-SI or wrongly-cased units are a finding, not a parse failure
Mfg date | Mfg, Mfd, Manufactured on, Packed on, Date of Packing, निर्मित | `MM/YYYY`, `MM-YY`, `MON YYYY`, `DD/MM/YYYY` | Reject future dates; flag implausible ages
Best before | Best Before, Use By, Expiry, Exp, उपयोग की तिथि | Date, or a duration ("9 months from packing") | Duration form requires the mfg date to evaluate
Manufacturer | Manufactured by, Mfd by, Packed by, Marketed by, Imported by | Multi-line block until a terminator | "Marketed by" alone does **not** satisfy 6(1)(a) — a distinct and commonly-missed finding
Address | (part of the manufacturer block) | Block containing a 6-digit PIN-like token | PIN presence is the strongest signal that an address is complete
Consumer care | Customer Care, Consumer Complaints, For queries, Helpline | Phone, email or address | Any one satisfies; presence of an 1800-series number is a strong positive
Country of origin | Country of Origin, Made in, Product of | Country name from a list | Only required when the import flag is set
FSSAI licence | FSSAI, Lic. No., License No. | Exactly 14 digits | Structural validation only
~~~

## 7.5 Image conditioning before OCR

Applied on the server to captured panels before the accurate re-read. Deterministic, cheap, and worth several points of OCR accuracy on the hardest labels:

- **Perspective rectification** — detect the package's quadrilateral and warp it to a rectangle. Directly improves both OCR and every geometry measurement.
- **Glare suppression** — inpaint specular highlights identified by the S1 glare mask.
- **CLAHE** — adaptive contrast for low-contrast print (silver-on-silver, embossed text).
- **Deskew** — Hough-line-based rotation correction.
- **Curved-surface handling** — for bottles and pouches, a cylindrical unwrap using the detected silhouette. This is optional and marked as a stretch item; it is genuinely hard and should be the first thing cut if Sprint 4 is tight.

Each conditioning step is individually toggleable and its contribution is measured against the gold set (§15), so nothing stays in the pipeline on faith.

# [SECTION 8] Geometry — Measuring Honestly

## 8.1 The scale problem, stated plainly

A photograph contains no absolute scale. A 4 mm numeral photographed from 10 cm and a 40 mm numeral photographed from 100 cm produce identical pixels. v1 proposes inferring scale from detected package edges, but a package edge only yields scale if the package's true dimensions are already known — which they are not.

So the system separates two classes of geometric claim, and is explicit in the UI about which it is making.

## 8.2 Class 1 — Scale-free checks (always available, high confidence)

These need no reference at all and should carry the geometry story in the demo.

~~~t|26,74
Check | Method
**Rule 8(2) font parity** | Ratio of MRP numeral height to net-quantity numeral height, from bounding boxes in the same frame. Flag when outside tolerance. Exact up to box tightness; no scale needed.
**Rule 9 spacing** | Blank space around the net-quantity declaration, expressed in multiples of that declaration's own numeral height — which is precisely how the Rule is written. The rule is *self-scaling*, so pixels suffice. Requires the uncropped panel still.
**Co-location** | Spatial clustering of the Rule 6 declaration boxes within a single panel still. Report as "declarations clustered / scattered across N groups", advisory band unless one frame contains them all.
**Relative legibility** | Numeral height of each declaration as a fraction of the panel's own height. A declaration far below the panel's median text size is worth surfacing even without a millimetre figure.
~~~

## 8.3 Class 2 — Absolute millimetres (only with a real reference)

Attempted only when one of these is available, in descending confidence. The verdict records **which** reference was used — a measurement without a stated basis is not a measurement.

~~~t|10,26,34,30
Rank | Reference | How | Confidence
1 | **AR depth + camera intrinsics** | ARCore (Android) / ARKit (iOS) give real-world scale for a plane at a known depth. Combined with focal length and sensor size, pixels convert to millimetres directly. | High
2 | **Printed reference card** | A credit-card-sized card with an ArUco marker of known dimensions, laid beside the package. Detected by OpenCV's ArUco module; gives an exact pixels-per-mm on the marker's plane. Officers can carry one; it costs nothing to print. | Very high, but requires the officer to place it
3 | **Barcode as a coarse ruler** | An EAN-13 symbol has a defined nominal width, but is legally printed at 80–200% magnification, so this bounds the answer rather than fixing it. | Low — usable only to say "certainly below" or "certainly above", never for a point estimate
— | **None available** | Emit no number. Surface "Scale reference unavailable" and offer the on-screen ruler tool. | n/a
~~~

::: add The on-screen ruler — a small feature that resolves the whole problem
When no automatic reference exists, show the captured panel with a draggable calliper overlay and ask the officer for one known dimension — most often the package's own printed net quantity dimension, or simply a physical ruler held against it. One drag calibrates the frame, and every measurement on that panel becomes exact and legally defensible because a human established the scale. This converts the project's hardest technical problem into a five-second interaction, and it is fully in the spirit of human-in-the-loop enforcement. **Build this before attempting AR scale.**
:::

## 8.4 What gets reported

~~~t|30,26,44
Situation | Severity | Text shown to the officer
Parity ratio outside tolerance | **Violation** | "MRP numerals are 0.6× the height of the net-quantity numerals. Rule 8(2) requires equal height."
Spacing below the multiplier | **Violation** | "Blank space to the left of the net-quantity declaration is 0.9× the numeral height; at least 2× is required."
Scale established, height below floor | **Violation** | "Numeral height 3.1 mm, measured against the reference card. Minimum for this panel area is 4 mm."
Scale established, height near floor | Advisory | "Numeral height 4.1 mm against a 4 mm minimum — within measurement tolerance. Recommend manual confirmation."
No scale reference | Advisory | "Font height could not be measured — no scale reference. Tap to measure manually."
~~~

The last row is the one that matters. Competing tools produce a number there anyway. Not producing one, and saying why, is both more honest and more useful — and it is a differentiator you can state in one sentence to a judge.

# [SECTION 9] Identity and Fraud Cross-Check

v1's barcode cross-check is its most original idea and I want it to survive contact with a demo floor. As written it cannot: it depends entirely on GEPIR, a free registry that is rate-limited, frequently slow, and inconsistently populated for Indian GTINs. If the lookup fails, v1's differentiator simply does not appear.

The fix is to make identity a **composite of four signals**, three of which work offline and never fail.

## 9.1 The four signals

~~~t|8,24,38,30
# | Signal | What it proves | Availability
1 | **GS1 check digit** | The GTIN is arithmetically well-formed. A failure means the barcode is fabricated, mis-transcribed, or printed from a bad source — a strong and immediate fraud indicator. | Always. Offline, microseconds.
2 | **GS1 prefix region** | Which national GS1 body allocated the number. A `890` prefix indicates GS1 India. Mismatch against a "Made in ___" declaration, or an import with no country-of-origin declaration, is a real finding. | Always. Offline, from a small bundled table.
3 | **Prior-scan consensus** | Every previous scan of this GTIN in your own repository recorded an OCR-extracted manufacturer name. If nine prior scans say one company and this one says another, that is a strong counterfeit signal — **and it gets stronger the more the tool is used.** | Offline on the server; grows with the corpus.
4 | **External registry (GEPIR)** | The registered brand owner of the GTIN. Authoritative when available. | Best-effort. Cached permanently on first success; visibly degraded when unavailable.
~~~

::: add Signal 3 is the sleeper feature
Prior-scan consensus is better than GEPIR for this problem, because it is populated exactly where enforcement actually happens and it improves with every scan. It costs one indexed query. It also makes a compelling narrative arc for a pitch: *the tool gets better at detecting counterfeits the longer a department uses it*, with no model training anywhere. Build this; treat GEPIR as a bonus.
:::

## 9.2 Fuzzy matching, done properly

Comparing an OCR-extracted manufacturer name to a registry or consensus name needs care, or it becomes a false-positive machine.

- Normalise aggressively before comparing: case-fold, strip legal-form suffixes (`Ltd`, `Limited`, `Pvt`, `Private`, `LLP`, `Industries`, `Foods`), collapse punctuation and whitespace.
- Compare with a **token-set ratio** rather than raw edit distance, so word order and extra tokens do not sink an otherwise clean match.
- Use PostgreSQL `pg_trgm` for the corpus-wide search so the fuzzy work happens in an indexed database query rather than a Python loop over every row.
- **Three bands, not two:** `match` (above the upper threshold), `no_match` (below the lower), and `inconclusive` (between). Only `no_match` produces a finding. `inconclusive` is shown to the officer as a question, not an accusation.
- Thresholds are tuned against the gold set and stored in the rule pack, not hard-coded.

## 9.3 What a fraud finding looks like

A mismatch is emitted as its own severity class — `identity_alert` — kept visually distinct from declaration violations, because it means something categorically different and may warrant a different enforcement action.

```
{"id": "f7", "severity": "identity_alert", "signal": "prior_scan_consensus",
 "title": "Manufacturer name differs from 11 prior scans of this GTIN",
 "detail": "This label reads 'Britania Industries'. GTIN 890xxxxxxxxxx was recorded
            as 'Britannia Industries Ltd' in 11 prior scans across 4 districts.
            Spelling variance may indicate counterfeit packaging.",
 "confidence": "medium", "prior_scan_ids": ["...", "..."], "evidence": ["ev_2"]}
```

Note that the finding shows its working — the count, the districts, the prior name. An officer can act on that. They cannot act on "fraud score 0.71".

## 9.4 Repeat-offender detection — aggregate at the right level

v1 keys the repository on GTIN, which is correct for product identity but wrong for offender identity: a single manufacturer holds thousands of GTINs, so per-GTIN counting will almost never reach a threshold that looks like a pattern.

**Aggregate on the GS1 company prefix** — the leading digits of the GTIN that identify the brand owner — in addition to the GTIN itself. This turns "this exact product was flagged twice" into "this manufacturer has been flagged 34 times across 6 districts for the same missing declaration", which is the finding an enforcement department actually acts on.

~~~t|24,76
Aggregation level | Question it answers
GTIN | "Has this exact product been flagged before?"
**GS1 company prefix** | "Has this manufacturer been flagged before, across all their products?"
Normalised manufacturer name | Catches manufacturers without barcodes at all — fuzzy-grouped via `pg_trgm`
Rule ID × manufacturer | "Is this a systematic omission or a one-off printing error?" — the most actionable pattern of all
~~~

# [SECTION 10] E-Commerce Batch Mode

## 10.1 Why this mode deserves more than v1 gives it

v1 treats e-commerce as "download the listing images and run them through the image pipeline." That misses the larger half of the opportunity. Online listings are required to display the mandatory declarations **on the listing page**, and on most platforms those declarations live in **HTML text**, not in an image. Text is free to check, exactly accurate, and needs no OCR at all.

So batch mode checks two surfaces and reconciles them.

~~~t|22,44,34
Surface | How it is checked | Value
**Listing HTML text** | Direct extraction from the product-detail and specification blocks; the cascade runs over text with no OCR error at all | Highest precision findings in the entire system — no OCR uncertainty anywhere
**Listing images** | Downloaded, conditioned, OCR'd, then the standard pipeline | Catches declarations that exist only in the pack shot
**Reconciliation** | MRP in text vs MRP on the pack image; net quantity in text vs on pack | **A mismatch between the two is its own violation** and is a genuinely novel check
~~~

::: add Text-vs-image reconciliation is the strongest idea in this mode
A listing that advertises one MRP in its HTML and shows a different MRP on the packaging photograph is a clear, high-confidence, screenshot-documentable finding — and it is invisible to any tool that only looks at images. It requires no new machinery beyond running the cascade twice and comparing. Build it.
:::

## 10.2 Pipeline

```
URLs / CSV ───> queue (arq)
     └─> fetch ───> static HTML? ──yes───> BeautifulSoup
                        └──no───> headless Chromium (Playwright)
                  │
                  ├───> text extraction ───> cascade ───> field set A
                  └───> image download ───> conditioning ───> OCR ───> cascade ───> field set B
                                 │
                        reconcile A vs B ───> applicability gate ───> evaluator
                                 │
                        per-URL verdict ───> batch report (CSV / PDF / dashboard table)
```

## 10.3 Operating it responsibly

This is a public-facing crawler, and it is worth being deliberate about how it behaves — both because it is the right thing to do and because "we rate-limited it and identified ourselves" is a much better answer to a judge's question than a shrug.

- Respect `robots.txt`; identify the crawler honestly in the user agent.
- Per-domain concurrency caps and polite delays; exponential backoff on `429`/`503`.
- Cache aggressively — a listing re-checked the next day should not be re-fetched.
- Cap batch size per job, and make the cap a server setting.
- Store only what a finding needs: the extracted declarations, the evidence crop, the URL and the timestamp. Not a full page mirror.
- Treat all fetched page content strictly as **data**. Text scraped from a third-party listing is never interpreted as an instruction by anything in the system.

## 10.4 Output

A results table, one row per URL: platform, product title, GTIN if extractable, verdict, finding count, and the top finding. Sortable, filterable, exportable to CSV, and to a single consolidated PDF suitable for attaching to a departmental communication. Per-row drill-down opens the same verdict view the mobile app uses, so there is exactly one verdict UI in the product.

::: why
Batch mode is the feature that turns a single officer's tool into a *department's* tool. One officer with a scanner checks perhaps eighty packages a day. One officer with batch mode sweeps four hundred listings before lunch and produces a ranked worklist. When you present, frame it that way — it is the strongest scale argument available to this project.
:::

# [SECTION 11] Mobile Application — UX

## 11.1 Who this is actually for

A Legal Metrology inspector standing in a market. Often one-handed, because the other hand holds the package. Frequently in direct sunlight or in a dim godown. Sometimes wearing gloves. On a mid-range Android device — assume a 4 GB, 2020-era phone as the performance target, not a flagship. Possibly with no signal. Under mild social pressure from a shopkeeper who would prefer they left.

Every design decision below follows from that paragraph, and it is worth restating it in the pitch, because it is what separates a tool built for a demo from one built for a job.

## 11.2 Screens

~~~t|14,86
Screen | Content
**A — Login** | Username, password, and a large offline indicator. JWT with refresh; role assigned server-side. **Credentials cached for offline re-entry** — a token that expires in a basement with no signal must not lock the officer out mid-inspection.
**B — Live Scan** | The core screen. Full-bleed camera, no shutter. Live boxes over detected text. Running checklist as a bottom sheet, collapsible to a single progress line. Barcode chip showing GTIN and identity status. Category chip, tappable to override. Capture-quality hint line. Large `Done` button, promoted once the active field set is satisfied; always available as `Finish anyway`.
**C — Verdict** | Header stating the honest summary ("3 issues found · 1 needs your check") with a provisional/refined badge. Findings grouped: **Violations**, then **Advisories**, then **Identity alerts**. Each expands to show the clause, plain-language explanation, the evidence crop, and a `This looks wrong` control. Repeat-offender banner where applicable. Actions: Export, Save & scan next, Flag for manual review.
**D — Measure** | The calliper tool from §8.3. Panel still, two draggable callipers, one known-length input, then exact measurements for any declaration on that panel.
**E — History** | Local-first list of this officer's scans, searchable offline, with sync status per row. Tap for the full verdict.
**F — Queue** | Explicit view of pending uploads: count, size, last attempt, retry control. Officers need to *see* that their evidence is safe.
~~~

## 11.3 The capture coach — the highest-leverage UI in the project

One hint line at a time, immediately below the viewfinder, driven by the S1 admission gate. Never more than one message; never a generic "scanning…".

~~~t|26,38,36
Condition | Hint | Why it matters
Laplacian variance low | "Hold steady" | Motion blur is the most common OCR killer
Specular region detected | "Glare — tilt the pack slightly" | Dominates on metallised film, which is most Indian snack packaging
Text height below threshold | "Move closer" | Small text is the main cause of missed declarations
Package edge outside frame | "Move back — fit the whole panel" | Required for panel-area and spacing geometry
Low light | "Tap for torch" | One tap, no menu
Field set stable | "Front panel captured — rotate to the back" | Makes multi-panel scanning reliable rather than accidental
All fields confirmed | "Ready — tap Done" | Removes the guesswork about when to stop
~~~

::: why
Frame quality is worth more accuracy than any downstream algorithm in this document. A tool that teaches the officer to take a good photograph, in the moment, in seven words, beats a tool with cleverer OCR and no coaching. It is also cheap to build and immediately visible in a demo.
:::

## 11.4 Field-conditions design rules

- **Sunlight-legible theme.** High-contrast dark UI, minimum 16 pt body text, no thin weights, no low-contrast greys on the scan or verdict screens.
- **One-handed reach.** All primary actions in the lower third. Nothing critical in a top corner.
- **Large targets.** Minimum 48 dp; assume gloves and a hurried tap.
- **Bilingual UI.** Full Hindi and English localisation with a one-tap switch. Findings are authored bilingually in the rule pack, not machine-translated at runtime — a legal citation must read correctly in both.
- **Haptics for state changes.** A distinct pulse on field-confirmed and on verdict-ready, so the officer can keep their eyes on the package rather than the screen.
- **No blocking spinners.** Every wait shows what is happening and what is already known. This is v1's "transparent progress" differentiator, kept and sharpened.
- **Battery discipline.** Frame processing throttles to roughly 8 fps and stops entirely when the checklist is satisfied. Continuous full-rate OCR will drain a mid-range phone in under an hour, which makes the tool unusable on a full inspection round.

## 11.5 The correction loop

Every finding carries a `This looks wrong` control. One tap, an optional reason from a short list, submitted to `/v1/feedback`.

This is three features for the price of one: officers gain agency and stop resenting false positives; the eval set grows from real field data continuously; and you gain a headline metric — *officer-confirmed precision* — that no competing team will have. It costs perhaps half a day to build. Build it in Sprint 3, not as a stretch goal.

# [SECTION 12] Web Dashboard

Role-gated: officers see their own scans; senior officers and controllers see their jurisdiction; admins see everything and manage users. React + Vite + Tailwind, charts via Recharts.

~~~t|18,82
Screen | Content
**Overview** | Scans and violations for the period; compliance rate trend; top violated rules; top flagged manufacturers; category breakdown. Every tile is a link into a pre-filtered scan list — a dashboard number that cannot be drilled into is decoration.
**Scan Explorer** | The workhorse. Filter by date, officer, district, category, verdict, rule, GTIN, manufacturer (fuzzy). Saved views. CSV export. Row click opens the shared verdict view.
**Offenders** | Aggregated by GS1 company prefix, GTIN and fuzzy manufacturer name. Columns: flagged count, distinct districts, distinct officers, date range, most common rule violated. Sortable, exportable — this is the screen a controller uses to decide where to send a team.
**Rule Analytics** | Violation frequency per rule, per category, over time. Answers "which single declaration is most often missing nationally?" — a question a department genuinely wants answered and which no single officer can answer alone.
**Batch Sweep** | Paste URLs or upload a CSV; live per-URL progress; results table; consolidated export.
**Rule Pack** | View the active pack, its version, hash and per-table review status. Legal reviewers can see exactly which thresholds are verified and which are pending, and sign off. This screen is what makes §4.5's governance story real rather than aspirational.
**Users** | Admin only. Create officers, assign roles and jurisdictions, deactivate.
**Audit** | Append-only log viewer with hash-chain verification status. §14.2.
~~~

::: note One verdict view, three surfaces
The verdict component is written once and rendered in the mobile app, the dashboard drill-down and the PDF report. Three divergent renderings of the same legal finding is a correctness risk, not just a maintenance cost — an officer and a controller must be looking at literally the same statement.
:::

# [SECTION 13] Data Model, Offline and Sync

## 13.1 Server schema

Corrections to v1: verdicts are versioned against a rule pack; evidence carries hashes; identity is separated from products; feedback and audit tables are added; and offender aggregation gets a materialised view.

```
users(id, username, password_hash /*argon2id*/, role, jurisdiction,
      is_active, created_at, last_login_at)

scans(id, client_scan_id UNIQUE, officer_id FK, source /*mobile|batch*/,
      gtin, category, category_source, applicability_json,
      verdict, verdict_stage, verdict_json, rulepack_version, rulepack_sha256,
      device_meta_json, geo_point, captured_at, received_at, processed_at,
      latency_ms_json)

findings(id, scan_id FK, severity /*violation|advisory|identity_alert*/,
         statute, rule_id, sub_clause, title, detail_en, detail_hi,
         confidence, extraction_stage, measurement_json, evidence_ids[])

evidence(id, scan_id FK, kind /*panel|crop*/, field_name, storage_key,
         sha256, width, height, captured_at)

products(gtin PK, check_digit_valid, gs1_prefix, prefix_region,
         registry_name, registry_address, registry_fetched_at,
         consensus_name, consensus_scan_count, first_seen, last_seen)

feedback(id, finding_id FK, officer_id FK, judgement /*correct|incorrect|unsure*/,
         reason_code, note, created_at)

audit_log(id, seq, actor_id, action, subject_type, subject_id,
          payload_sha256, prev_hash, entry_hash, server_ts)

batch_jobs(id, submitted_by FK, status, url_count, done_count, created_at)
batch_items(id, job_id FK, url, platform, status, scan_id FK, error)

MATERIALIZED VIEW offenders  -- refreshed on a schedule
  (aggregation_key, aggregation_level /*gtin|company_prefix|name*/,
   display_name, flagged_count, district_count, officer_count,
   first_flagged, last_flagged, top_rule_id)
```

Indexes that matter: `scans(gtin)`, `scans(officer_id, captured_at desc)`, `findings(rule_id)`, a GIN trigram index on the normalised manufacturer name, and a partial index on `scans(verdict) where verdict <> 'COMPLIANT'`, since almost every dashboard query filters to non-compliant rows.

## 13.2 On-device store

SQLite via `op-sqlite`. Mirrors `scans`, `findings` and `evidence` for the officer's own records, plus an `outbox` table driving the upload queue. History and search work fully offline; sync is a background reconciliation, not a prerequisite for use.

## 13.3 Sync protocol

~~~t|24,76
Property | Design
Idempotency | Every scan carries a client-generated UUID. The server upserts on it. A retried upload after a timeout can never create a duplicate record.
Ordering | Not required. Scans are independent; the outbox drains in any order.
Conflict | Effectively impossible — scans are append-only and single-author. The server's refined verdict supersedes the device's provisional one for the same `client_scan_id`, and both are retained.
Resumability | Panel images upload in chunks with resume support; a dropped connection mid-upload costs the remaining chunks, not the scan.
Backpressure | The outbox is capped by total bytes. On approach, image quality steps down and the officer is warned. Never silently drop evidence.
Retention | Configurable local retention (default 30 days after confirmed sync), then local evidence is purged while the verdict record is kept.
~~~

# [SECTION 14] Evidence Integrity, Security and Privacy

For a tool whose output may support a legal notice, this section is not boilerplate. It is also, pragmatically, the section that distinguishes a hackathon project from something a department could actually adopt — and it is cheap to build.

## 14.1 Authentication and authorisation

- Argon2id password hashing. Short-lived access JWTs with refresh tokens; refresh tokens revocable server-side.
- Role and jurisdiction enforced **in the query layer**, not in the UI. Every scan query is scoped by the caller's jurisdiction at the repository level, so a UI bug cannot leak another district's data.
- Rate limiting on authentication and on batch submission.
- Signed, short-expiry URLs for evidence images. Evidence is never served from a public bucket.

## 14.2 The evidence chain

v1 says "hash-timestamped". That is the right instinct, under-specified. The concrete design:

1. On capture, the device computes SHA-256 of each panel image and includes it in the upload.
2. The server independently recomputes it and rejects a mismatch — this detects both corruption and tampering in transit.
3. The verdict JSON is canonicalised and hashed.
4. An audit entry is appended containing the actor, action, subject, payload hash, and **the hash of the previous entry**, forming a chain. Any retroactive alteration of a stored verdict breaks the chain from that point forward and is detectable by a single verification pass.
5. The chain head is signed with a server key and, optionally, published to an external timestamp authority once daily — which upgrades "we say this record is from March" to something a third party can corroborate.

The dashboard's Audit screen runs the verification and shows a green or broken-chain state. This takes perhaps a day to build and is disproportionately persuasive to a government-facing panel.

## 14.3 Privacy

- **Purpose limitation.** Capture only what a compliance finding needs. Panel stills of a product label, not the shopkeeper, not the premises, not bystanders.
- **Location.** Coarse location (district) by default; precise GPS only when the officer explicitly enables it for a given inspection.
- **Officer data.** Personal data of officers is minimised and access-logged; the audit log records reads of another officer's scans.
- **Retention policy** stated in the deployment documentation, with a configurable evidence-retention window and a documented deletion path — relevant under the Digital Personal Data Protection Act, 2023.
- **On-device mode** available for sensitive inspections, in which no image ever leaves the phone and the verdict is device-only.

## 14.4 Human-in-the-loop, kept explicit

The system never issues, drafts or transmits a legal notice. It produces a finding, an evidence set and a citation, all of which an officer reviews and either accepts or rejects. Every exported report carries a footer stating that it is a machine-generated preliminary assessment requiring officer verification, together with the rule-pack version and content hash that produced it. This is v1's principle, kept verbatim, because it is correct.

# [SECTION 15] Evaluation and Quality Gates

This section did not exist in v1 and it is the most important addition in this document. Everything else is a design opinion; this is how you find out whether the design works — and it is the single most persuasive thing you can put in front of a judging panel, because almost no competing team will have it.

## 15.1 The gold set

**Target: 400 labelled photographs**, collected in the first two sprints. This is achievable — it is roughly two hours of shopping and two evenings of labelling split across a team.

~~~t|24,16,60
Stratum | Count | Purpose
Compliant, well-shot | 80 | The false-positive test set. **This is the most important stratum** and the one teams forget. If the tool flags these, it is unusable.
Non-compliant, known defect | 120 | One deliberately identified violation each, so per-rule recall is measurable
Category coverage | 80 | Food, cosmetics, electronics, stationery, textile, pharma, household — with the applicability edge cases
Hard capture conditions | 60 | Glare, curved bottles, low light, motion blur, crumpled pouches, metallised film
Multilingual | 30 | Hindi-only, Hindi+English, regional-script labels
Exempt / out of scope | 30 | Small sachets, loose goods, institutional packs — must return "not in scope", not a violation list
~~~

Each item is labelled with: ground-truth field values, the correct category, applicability status, and the exhaustive list of true violations with clause references. Labels are stored as JSON beside the image and reviewed by a second team member. Where possible, have a Legal Metrology officer or a law student review the violation labels — that single conversation is worth more than a week of guessing, and it also gives you a quotable domain endorsement for the pitch.

## 15.2 Metrics

~~~t|26,20,54
Metric | Target | Why this target
**Flag precision** | ≥ 0.95 | The primary metric (P3). One false accusation in twenty is roughly the tolerance ceiling before officers disengage.
Flag recall | ≥ 0.80 | Catching four in five real violations transforms enforcement throughput. Chasing the fifth at the cost of precision is a bad trade.
Field extraction F1, per field | ≥ 0.90 | Reported per field, because a single mean hides the one field that never works
Category accuracy | ≥ 0.92 | Drives which rules run; an error here cascades into every finding
Applicability accuracy | ≥ 0.98 | An in-scope/exempt error produces an entirely wrong verdict
False-positive rate on the compliant stratum | ≤ 0.05 | Stated separately because it is the number that decides adoption
Provisional latency, p95 | ≤ 1000 ms | On the mid-range target device, not a flagship
Refined latency, p95 | ≤ 3000 ms | On a typical 4G link
~~~

## 15.3 The harness

A single command runs the full evaluation and prints a table. It must be trivially runnable, because a metric that takes ceremony to produce stops being produced.

```bash
python -m eval.run --set gold --report out/eval.html --json out/eval.json
```

It emits: the metrics table, a per-rule breakdown, a confusion matrix for categories, the ten worst failures with images and diffs, and a stage-latency histogram. The HTML report is directly presentable — **put it on a slide**.

Three additional harness modes worth having:

- `--compare <baseline.json>` — regression diff against the last committed run, so any change's effect on accuracy is visible in the pull request.
- `--ablate` — runs with individual pipeline stages disabled to show each one's contribution. This is how you decide whether cylindrical unwrap or glare suppression is actually earning its complexity, and it produces a genuinely impressive slide.
- `--field-audit` — dumps every extraction with its stage and confidence, for eyeballing where the cascade is falling through to Stage C.

## 15.4 CI gates

~~~t|30,70
Gate | Rule
Rule-pack schema | Pack must validate against its JSON Schema; unknown rule IDs fail the build
**Evaluator conformance** | TypeScript and Python evaluators must produce byte-identical verdicts across all ~200 fixtures. Any divergence fails.
Accuracy regression | Flag precision may not fall below the committed baseline; recall may not fall more than 2 points
Latency regression | Provisional-path benchmark on fixed inputs may not regress more than 15%
Unreviewed thresholds | Any rule-pack table with `status: PENDING_LEGAL_REVIEW` may only emit advisories — enforced by a test, not by convention
~~~

::: why
The evaluator conformance gate is what lets you say, truthfully and without qualification, "the offline verdict and the server verdict are the same verdict." That claim is central to the offline story, and without the gate it is an aspiration that will quietly stop being true the first time someone patches one evaluator and not the other.
:::

# [SECTION 16] Performance Engineering

Speed is one of the three stated goals, so it gets a budget, an instrument and a set of specific techniques — not an assertion.

## 16.1 Latency budget — provisional path (device only, no network)

~~~t|34,18,48
Stage | Budget | Technique
Frame admission (blur/glare/coverage) | 8 ms | Downscale to 320 px wide, greyscale, integer ops, in a worklet
Barcode decode | 15 ms | ML Kit, only on admitted frames
On-device OCR, one frame | 120 ms | ML Kit v2; throttled to ~8 fps, not every frame
Extraction cascade | 12 ms | Pure TS over a few dozen text blocks
Applicability + rule evaluation | 6 ms | Pure function over an in-memory rule pack
Scale-free geometry | 15 ms | Box arithmetic only
Panel capture + JPEG encode | 180 ms | Native, off the JS thread
Verdict render | 40 ms | Precomputed view model
**Total from "Done" to verdict** | **≈ 300 ms** | Live stages already ran during scanning; the budget leaves 3× headroom against the 1 s target
~~~

## 16.2 Latency budget — refined path

~~~t|34,18,48
Stage | Budget | Technique
Upload, 2 panels @ ~250 KB | 900 ms | Resize to the OCR-optimal long edge (~1600 px) before upload; JPEG q80; HTTP/2 multiplexed on one connection
Image conditioning | 180 ms | OpenCV; steps toggleable and individually measured
Accurate OCR | 600 ms | One request per panel, issued concurrently
Cascade + evaluation + geometry | 90 ms | —
Identity checks | 40 ms | Offline signals plus a cached registry read; the live GEPIR call is **out of band** and never blocks the verdict
**Total** | **≈ 1.8 s** | Comfortably inside the 3 s target with margin for a poor link
~~~

## 16.3 Techniques that actually move the numbers

- **Do not OCR every frame.** Throttle to roughly 8 fps and skip any frame that fails admission. This alone is the largest single win available on the device, in both latency and battery.
- **Resize before upload, not after.** Cloud Vision does not benefit from a 12-megapixel image; a 1600 px long edge is near-optimal for text. This is a ~5× reduction in upload bytes, which on a weak link is the dominant term in the entire refined budget.
- **One connection, kept warm.** HTTP/2 with connection reuse; pre-warm the TLS session when the camera opens, so the handshake is already paid for by the time there is anything to upload.
- **Stop scanning when done.** Once the active field set is satisfied, halt the frame processor. The phone stops heating and the battery survives a full inspection round.
- **Cache the rule pack in memory,** parsed once at app start, never re-read per scan.
- **Index for the queries you actually run.** The partial index on non-compliant scans matters because essentially every dashboard query has that predicate.
- **Make the registry call fully out of band.** GEPIR is the slowest and least reliable component in the system, and nothing should ever wait on it. Fire it, cache the result, update the identity panel when and if it lands.

## 16.4 Instrumentation

Every stage records its duration into the `latency_ms_json` column. A dashboard panel shows p50/p95/p99 per stage across all scans, split by device model. When the team claims a latency number in the presentation, it comes from that panel — measured on real scans, on real phones, not from a stopwatch on a laptop.

# [SECTION 17] Final Technology Stack

Changes from v1 are marked. Where a v1 choice was sound it is kept without comment, because churn for its own sake costs sprint time.

~~~t|22,30,48
Concern | Choice | Note
Mobile framework | React Native (Expo dev-client) | v1: bare RN. The dev-client gives you over-the-air updates and a far faster iteration loop while still allowing native modules.
Camera | react-native-vision-camera v4 + react-native-worklets-core | **Kept.** Correct choice. Worklets keep frame processing off the JS thread — essential for the fps target.
On-device barcode | ML Kit Barcode Scanning | **Kept.**
On-device OCR | ML Kit Text Recognition v2 (Latin + Devanagari bundled) | **Kept.** Bundle the models rather than relying on Play Services download, or the first scan on a fresh device fails without a network.
Accurate OCR | Google Cloud Vision (primary) · PaddleOCR (self-hosted) | **Changed:** PaddleOCR runs server-side, not on-device. Behind a single `OCRProvider` interface so a third engine can be added without touching the pipeline.
Device rule engine | TypeScript evaluator over the shared rule pack | **New.** The fix for v1's offline gap.
Local device store | SQLite (op-sqlite) | **New.** Offline history and the durable upload outbox.
Backend | FastAPI, async | **Kept.**
Job queue | arq (Redis) | **New.** Batch scraping and report rendering need a real queue; `BackgroundTasks` will not survive a restart. arq is small and async-native.
CV / geometry | OpenCV + numpy | **Kept.**
Database | PostgreSQL + `pg_trgm` | **Extended.** Trigram indexing moves fuzzy manufacturer matching into the database.
Object storage | S3-compatible (Cloudflare R2, or MinIO self-hosted) | **Changed** from filesystem paths. Signed expiring URLs; a self-hosted MinIO path matters for a government deployment.
Report rendering | Headless Chromium via Playwright | **Changed** from WeasyPrint. Playwright is already needed for scraping, so this removes a dependency instead of adding one, and avoids the GTK toolchain on Windows. DOCX export via `python-docx` for the editable format v1 asked for.
Scraping | BeautifulSoup + Playwright | **Kept.**
Web dashboard | React + Vite + TypeScript + Tailwind + Recharts | **Kept**, stack specified.
Auth | JWT access + refresh, Argon2id | **Extended.**
Observability | structlog + Prometheus-style counters and histograms | **New.** You cannot defend a latency claim you do not measure.
CI | GitHub Actions: lint, tests, conformance suite, eval regression | **New.**
Deployment | Docker Compose (full offline stack) + Render/Railway + Vercel | **Extended.** The Compose path lets the entire system run on a laptop with no internet — insurance against demo-day connectivity.
~~~

::: warn Two dependencies to de-risk in week one
**Cloud Vision billing** — a free-tier quota exhausted the night before the demo is a foreseeable and fatal failure. Set a budget alert, keep the PaddleOCR path warm and tested, and rehearse the demo at least once in Edge mode.

**ML Kit Devanagari model delivery** — verify on a factory-reset device with no network that Hindi recognition works from a cold start. If the model is downloaded on demand rather than bundled, the first scan on a fresh device will silently fail, and that is exactly the device a judge will hand you.
:::

# [SECTION 18] Repository Layout

A monorepo. The shared rule pack is the reason: it must be versioned atomically with both evaluators, and the conformance suite must be able to run both from one checkout.

```
sih_project/
├─ rulepack/
│  ├─ schema/rulepack.schema.json
│  ├─ lmpc-2011.json                 # the core pack — the legal heart of the project
│  ├─ extended-fssai.json
│  ├─ extended-bis.json
│  ├─ lexicons/{en,hi}.json          # anchors, synonyms, commodity nouns
│  └─ CHANGELOG.md                   # every clause change, dated, with reviewer
├─ packages/
│  └─ rule-engine-ts/                # TS evaluator + cascade (bundled into the app)
├─ conformance/
│  ├─ fixtures/*.json                # ~200 input → expected-verdict pairs
│  └─ run_{py,ts}.{py,ts}            # both runtimes, same fixtures, CI-gated
├─ mobile/
│  ├─ src/camera/                    # vision-camera, frame processors, admission gate
│  ├─ src/scan/                      # cascade wiring, checklist state machine
│  ├─ src/verdict/                   # the shared verdict view model
│  ├─ src/measure/                   # calliper tool
│  ├─ src/db/                        # sqlite, outbox, sync
│  └─ src/i18n/{en,hi}.json
├─ backend/
│  ├─ app/api/                       # FastAPI routers
│  ├─ app/ocr/                       # OCRProvider: cloud_vision.py, paddle.py
│  ├─ app/extract/                   # Python cascade (mirrors the TS one)
│  ├─ app/rules/                     # Python evaluator
│  ├─ app/geometry/                  # OpenCV: rectify, glare, spacing, parity
│  ├─ app/identity/                  # check digit, prefix, consensus, GEPIR client
│  ├─ app/ecommerce/                 # fetchers, parsers, reconciliation
│  ├─ app/audit/                     # hash chain
│  ├─ app/reports/                   # HTML templates → Chromium → PDF; DOCX
│  └─ app/workers/                   # arq tasks
├─ dashboard/                        # React + Vite
├─ eval/
│  ├─ gold/                          # images + label JSON
│  ├─ run.py                         # the one command from §15.3
│  └─ baselines/                     # committed metric snapshots for CI diffing
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ RULE_SOURCES.md                # clause → statutory source → reviewer → date
│  └─ DEMO_SCRIPT.md
└─ docker-compose.yml                # full offline stack
```

::: note `docs/RULE_SOURCES.md` is worth building carefully
One row per rule identifier: the clause, the exact statutory text it derives from, the amendment it reflects, who verified it, and when. It is the document you hand a Legal Metrology officer when you ask them to check your work, and it is the artefact that most convincingly demonstrates you engaged with the law rather than paraphrasing a summary article.
:::

# [SECTION 19] Build Plan

Six sprints. Every sprint ends with something demonstrable — never a sprint whose output is only visible to the team. The **Cut line** on each sprint states what gets dropped first if that sprint runs long, decided in advance so the decision is not made at midnight under pressure.

## Sprint 1 — The legal core and the skeleton

The rule pack comes first, before any camera code. Everything else in this project is machinery for evaluating it, and building the machinery before you know what it evaluates is how teams end up with a beautiful pipeline that checks the wrong things.

- `rulepack.schema.json` and `lmpc-2011.json` with Rule 6 declarations, the Rule 7 table, Rule 8(2), Rule 9, and the applicability gate predicates. Every entry carries its source and review status.
- `docs/RULE_SOURCES.md` populated; **the legal-review pass scheduled with a domain expert this sprint, not later.**
- TypeScript and Python evaluators; 60 conformance fixtures; CI running both.
- FastAPI skeleton, Postgres schema, auth, Docker Compose up.
- RN app shell, login, camera preview with live ML Kit text boxes drawn.

**Demo:** feed a JSON field set to both evaluators from the command line and show identical, clause-cited verdicts. Unglamorous, and it is the foundation everything else stands on.
**Cut line:** the extended FSSAI/BIS packs. Core LMPC only.

## Sprint 2 — Extraction, and the gold set

- The three-stage cascade in both languages, with the normalisation pass.
- Anchor lexicons for English and Hindi.
- On-device barcode with check-digit and prefix validation.
- Blur, glare and coverage admission gates with the capture-coach hints.
- **Gold set collected and labelled — 400 images.** Start this on day one of the sprint; it is the long pole and it blocks every accuracy claim that follows.
- `eval/run.py` producing the metrics table.

**Demo:** the eval report, with real numbers. First honest read on where the system stands.
**Cut line:** the hard-conditions stratum drops to 30 images. Never cut the compliant stratum — it is the false-positive test.

## Sprint 3 — The full scan loop

- Panel capture, upload outbox, sync.
- Server OCR adapters (Cloud Vision and PaddleOCR) behind one interface.
- Provisional verdict on-device; refined verdict from server; merge-in-place UI.
- Verdict screen with evidence crops and clause citations.
- Scale-free geometry: Rule 8(2) parity, Rule 9 spacing, co-location.
- The `This looks wrong` correction loop.

**Demo:** end-to-end scan of a real package, in aeroplane mode, then again online showing the refinement. **This is the demo that wins the round** — rehearse it until it is boring.
**Cut line:** co-location clustering. Parity and spacing are the checks that matter.

## Sprint 4 — Identity, repository, dashboard

- Four-signal identity check; prior-scan consensus; GEPIR client with caching and out-of-band execution.
- Repeat-offender aggregation by company prefix; materialised view.
- Dashboard: overview, scan explorer, offenders.
- Audit hash chain and the verification view.
- Scan history and search, offline-capable.

**Demo:** scan a counterfeit-style label with a deliberately altered manufacturer name and show the identity alert with its prior-scan reasoning.
**Cut line:** GEPIR entirely. The three offline signals carry the feature, and cutting it removes your least reliable dependency.

## Sprint 5 — E-commerce, reports, polish

- Batch mode: fetch, HTML text extraction, image OCR, **text-vs-image reconciliation**, results table.
- Report rendering to PDF and DOCX with evidence photographs.
- Hindi UI localisation, sunlight theme, haptics, one-handed layout pass.
- The calliper measurement tool.
- Performance pass against the §16 budgets on the target device.

**Demo:** sweep ten real listing URLs and produce a ranked violation report; then the reconciliation finding — a listing whose HTML MRP disagrees with its own pack shot.
**Cut line:** DOCX export (PDF suffices) and cylindrical unwrap.

## Sprint 6 — Hardening and the pitch

- Accuracy push driven by the eval report's ten worst failures — fix what the data says is broken, not what feels broken.
- Latency measurement on the target device; publish the histogram.
- Legal review sign-off recorded in the rule pack; anything still `PENDING` demoted to advisory automatically.
- Failure-path rehearsal: no network, no Cloud Vision quota, no barcode, unreadable label, exempt package.
- Demo script rehearsed end-to-end at least five times, including the failure paths.

**Cut line:** nothing. This sprint is the buffer, and it should be protected — teams that plan six sprints of features ship five sprints of features and one of panic.

## Sequencing rationale

~~~t|24,76
Decision | Reason
Rule pack before camera | Everything downstream is machinery for evaluating it. Building the pipeline first risks a beautiful system that checks the wrong clauses.
Gold set in Sprint 2, not Sprint 5 | It is a *measurement instrument*. Built late, it tells you what is broken with no time left to fix it.
Offline path before online path | The harder constraint. A system built online-first is retrofitted to offline badly; the reverse is straightforward.
Identity after the core loop | It is the most novel feature, but it is worthless if the base scan is unreliable. Novelty on a shaky foundation loses to solidity.
Buffer sprint protected | The demo is a fixed date. The only variable you control is scope, and you control it best by deciding the cut lines in advance.
~~~

# [SECTION 20] Risk Register

Ordered by expected damage. Each has a mitigation that is someone's job in a specific sprint, not a hope.

~~~t|26,10,10,54
Risk | Likelihood | Impact | Mitigation
**Clause numbers are wrong** | Medium | **Severe** | The one error a Legal Metrology judge will certainly catch, and it undermines the project's central claim. Mitigation: `RULE_SOURCES.md`, expert review scheduled in Sprint 1, and unreviewed thresholds automatically demoted to advisories by a CI-enforced test.
**False positives on compliant packages** | High | **Severe** | The adoption killer. Mitigation: the compliant stratum of the gold set, precision as the primary metric, Stage-C findings capped at advisory, and the applicability gate.
Cloud Vision quota or billing failure at demo | Medium | Severe | PaddleOCR path kept warm and rehearsed; budget alerts; at least one full rehearsal in Edge mode.
Demo-floor network unavailable | **High** | Medium | Already mitigated by design — the provisional path needs no network. Rehearse the demo in aeroplane mode deliberately, and open with it rather than apologising for it.
GEPIR unavailable or uncovered | High | Low | Demoted to one of four signals; three work offline. Cuttable entirely in Sprint 4.
OCR fails on metallised or curved packaging | High | Medium | Glare suppression, capture coaching, perspective rectification; hard-conditions stratum in the gold set; honest "could not read" state rather than a wrong reading.
Devanagari model absent on a fresh device | Medium | Medium | Bundle the model rather than relying on on-demand download; verify on a factory-reset device.
Two evaluators drift apart | Medium | High | The conformance gate makes this a build failure rather than a silent inconsistency.
Battery drain during a real inspection round | Medium | Medium | Frame throttling; stop processing when the checklist is satisfied; measure on a full round.
Scope overrun | **High** | Medium | Per-sprint cut lines decided in advance; Sprint 6 protected as buffer.
Gold set never gets built | Medium | **Severe** | Every accuracy claim in the project depends on it. Assign one named owner in Sprint 2 with no other Sprint 2 deliverable.
Scraping blocked or rate-limited | Medium | Low | Caching, polite crawling, backoff; a fixture set of saved pages so batch mode always demos even if live fetching fails.
~~~

::: warn The two risks that actually decide the outcome
Everything else on this list is recoverable. **Wrong clause citations** and **false positives on compliant packages** are not — the first destroys credibility with the domain expert on the panel, and the second destroys the product's reason to exist. Both are mitigated by work scheduled in Sprints 1 and 2. Do not let either slip.
:::

# [SECTION 21] Demo Script

Four minutes, six beats. Every beat shows something no competing team can show, and the whole thing is rehearsed in aeroplane mode so that a dead venue network becomes a feature rather than a disaster.

~~~t|8,16,42,34
# | Beat | What you do | What you say
1 | **Offline first** | Phone visibly in aeroplane mode. Scan a real non-compliant snack packet. Verdict appears in well under a second. | "No network. This is a market basement. The officer still gets a full verdict, because the rule engine runs on the phone."
2 | **Cited, not scored** | Expand a finding: clause, plain-language explanation, and the cropped photograph of the actual offending text. | "Never a score. Always a clause and a photograph — because this becomes a legal notice, and the officer has to be able to defend it."
3 | **The false-positive test** | Scan a stationery item, then a 5 g sachet. Neither produces a wall of red; the sachet returns "outside the scope of Rule 6 — small-quantity exemption." | "Every other tool flags these. Category-conditional rules and an applicability gate are why an officer will still be using ours in week three."
4 | **Honest measurement** | Show a font finding with no scale reference: "could not measure — no reference." Tap the calliper, drag one known length, get an exact figure. | "We could print a number here. We don't, because there is no scale in a photograph. Instead we let the officer establish one in five seconds — and then the measurement is defensible."
5 | **Identity** | Turn the network on; the verdict refines in place. Scan a label with an altered manufacturer name — identity alert, citing prior scans. | "The barcode says one company. The label says another. We know because eleven prior scans across four districts said something different. This gets stronger the more the department uses it."
6 | **Scale** | Dashboard: repeat offenders by manufacturer, then a batch sweep over ten live listings, including a text-versus-image MRP mismatch. | "One officer checks eighty packages a day. One officer with this checks four hundred listings before lunch — and the department finally sees which manufacturer is systematically omitting which declaration."
~~~

### The closing slide

The evaluation report from §15.3. Precision, recall, per-rule breakdown, latency percentiles, gold-set composition.

::: why
Nearly every team will assert that their system is accurate. Showing a measured number, from a labelled dataset you built, with the failures included and the false-positive rate stated separately, is a different category of claim — and it is the thing a technical judge remembers after twenty pitches. Do not bury it; make it the last thing on the screen.
:::

### Questions you should have an answer ready for

~~~t|38,62
Question | Answer
"Isn't this just OCR plus regex?" | The extraction cascade, the applicability gate and the geometry checks — and the fact that the decision layer is a versioned, auditable rule pack rather than code. Show `RULE_SOURCES.md`.
"How do you know your rule interpretations are right?" | `RULE_SOURCES.md`, the named reviewer, and the mechanism that automatically demotes unreviewed thresholds to advisories.
"You said no ML, but ML Kit is a neural model." | The *decision layer* is deterministic. Perception may be statistical; judgement may not. Be precise about this — it is a fair challenge and there is a good answer.
"What happens when it is wrong?" | The officer taps `This looks wrong`, it enters the eval set, and the correction is a rule-pack update — no retraining, no redeployment. Show the officer-confirmed precision metric.
"Why should a department trust the evidence?" | Hash-chained audit log, signed chain head, evidence hashes verified server-side, rule-pack version recorded on every verdict.
"Can this scale to a state?" | Stateless API, queued batch workers, materialised offender views, and an entirely self-hostable stack — MinIO and PaddleOCR mean no data has to leave the department.
~~~

# [SECTION 22] Differentiator Summary

The eight claims below are what this project has that others do not. Each is stated as it should be said aloud, with the sentence that backs it up.

~~~t|6,30,64
# | Claim | The one sentence that supports it
1 | **Applicability before evaluation** | We ask whether the Rules apply before we ask whether they are met, so exempt packages return "not in scope" instead of a wall of false violations — the failure that makes competing tools get uninstalled.
2 | **A genuinely offline verdict** | The rule engine runs on the phone, and a CI conformance gate proves the offline verdict is byte-identical to the server's — so field enforcement does not depend on a signal.
3 | **Progressive verdicts** | A complete, usable verdict in under a second with no network, upgraded in place when connectivity allows, and never silently contradicted.
4 | **Rules as versioned, reviewable data** | Every clause, threshold and lexicon lives in a signed, versioned JSON pack a legal officer can read and approve — and unreviewed thresholds are automatically demoted to advisories.
5 | **Measurement with a stated basis, or none at all** | We report millimetres only when a real scale reference exists, name which one, and otherwise hand the officer a calliper — no fabricated precision anywhere.
6 | **Four-signal identity checking** | Check digit, prefix region and prior-scan consensus all work offline, so the counterfeit check never depends on an external registry — and it gets stronger every time the department uses the tool.
7 | **Offender aggregation at the manufacturer level** | Aggregating on the GS1 company prefix turns "this product was flagged twice" into "this manufacturer has been flagged 34 times across 6 districts for the same omission."
8 | **Measured accuracy, published** | A 400-image labelled gold set, per-rule precision and recall, a stated false-positive rate on compliant packages, and a CI gate that blocks regressions.
~~~

## Closing note

The strongest thing about the v1 specification was its instinct that this problem is a **legal** problem wearing a computer-vision costume. The rules, their conditionality, and the obligation to cite them are where the difficulty and the value both live; the OCR is a commodity.

This revision keeps that instinct and follows it further than v1 did — into the applicability gate, into rules as reviewable data, into refusing to state a measurement without a basis, and into measuring the system's accuracy rather than asserting it. Where it changes v1, it is almost always because a v1 mechanism would not have survived a real package, a real network, or a real officer.

Three things, if the schedule collapses and only three things can be true: the **rule pack is legally correct**, the **provisional verdict works with no network**, and the **false-positive rate on compliant packages is low and measured**. Everything else in this document is an amplifier on those three.