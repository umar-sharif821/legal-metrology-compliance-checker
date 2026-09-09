# Progress — SIH26034 Legal Metrology Compliance Checker

> Single source of truth for project state. Updated by `/handoff`, read by `/pickup`.
> Keep it terse. This file is read in full every session — every line costs tokens.

**Last updated:** 2026-09-09 · **Sessions completed:** 0 · **Current sprint:** 1

---

## Now

**Next task:** `T-1.1` — Repository scaffold
**Status:** not started
**Blocked on:** nothing

**Needed from user (non-blocking, ask when convenient):**
- Android phone model + Android version — decides whether the device is a fair
  stand-in for the mid-range performance target in plan §16.
- A Legal Metrology officer / law student contact for the rule-pack review (plan §4,
  needed before Sprint 6, ideally started in Sprint 1).

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

---

## Open questions

- [ ] **LMPC sub-clause letters unverified.** v1: MRP 6(1)(f), date 6(1)(g). Common reading: MRP 6(1)(e), date 6(1)(d). Everything legal stays `PENDING_LEGAL_REVIEW` until confirmed. *(plan §2.2, §4.2)*
- [ ] Rule 7 height table values are a plausible reconstruction, not verified against the Second Schedule. *(plan §4.3)*
- [ ] Small-quantity exemption thresholds (10 g / 10 ml and carve-outs) unverified. *(plan §4.1)*
- [ ] Best-before attribution — likely FSSAI Labelling & Display Regs 2020, not LMPC. *(plan §2.2)*

---

## Parked

Noticed but deliberately out of scope for now. Do not action without asking.

*(empty)*

---

## Task board

Status: `[ ]` todo · `[>]` in progress · `[x]` done · `[!]` blocked · `[~]` cut/deferred

### Sprint 1 — Legal core and skeleton
*Goal: both evaluators produce identical clause-cited verdicts from a JSON field set.*

- [ ] `T-1.1` Repo scaffold — monorepo dirs, tooling, lint/format, CI workflow stub · *plan §18*
- [ ] `T-1.2` `rulepack/schema/rulepack.schema.json` — rule-pack JSON Schema · *plan §4.5, §5.2*
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
