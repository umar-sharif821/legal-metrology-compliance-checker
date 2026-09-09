# This is not the rule pack

`demo-lmpc-v0.json` is **demo scaffolding**. Read this before touching it, citing it, or
copying anything out of it.

## What it is

A deliberately small, deliberately separate subset of the Rule 6(1) universal
declarations, written to make the one-day demo (`docs/DEMO_PLAN.md`) work end to end.
It exists so the demo can honour **P6 — rules are data, code is an interpreter** without
first completing `T-1.3`.

## What it is not

- **It is not `rulepack/lmpc-2011.json`.** That file is written by `T-1.3`, against
  `rulepack/schema/rulepack.schema.json`, with real provenance. It does not exist yet.
- **It does not conform to `rulepack.schema.json`.** Its shape is simpler and its key
  names differ. `rulepack/validate.py` never sees it — the validator globs
  `rulepack/*.json` at the top level only, and this file lives here precisely so that a
  demo artefact can never red a legal CI gate.
- **It is not reviewed.** No Legal Metrology officer has looked at a single entry.

## The rules it plays by anyway

These are not relaxed for the demo, because relaxing them would make the demo dishonest:

1. Every entry is `PENDING_LEGAL_REVIEW`, so every finding is capped at `advisory`.
   The evaluator enforces this at runtime, not by convention — see
   `../verdict/evaluate.ts`.
2. Contested sub-clause letters carry **both** readings in `clause.alternate_readings`,
   and the UI shows the contest. The open question in `docs/PROGRESS.md` is not quietly
   resolved here.
3. No statutory value — clause number, unit table, anchor lexicon, value shape — is
   hard-coded in TypeScript. It is all in this file. Field-trial tuning means editing
   JSON.
4. Nothing that would require a measurement is modelled at all, because the demo has no
   scale reference (**P4**).

## Why the sub-clause letters look hedged

They are hedged. `6(1)(e)` vs `6(1)(f)` for the retail sale price, and `6(1)(d)` vs
`6(1)(g)` for the date, are genuinely unresolved in this project — see **Open questions**
in `docs/PROGRESS.md`. Picking one and presenting it as settled is the specific failure
mode this project has decided to avoid.

## When this file dies

`T-1.3` writes the real pack. `T-1.7` writes the real evaluator against the real schema,
with a Python twin (`T-1.8`) and a conformance suite (`T-1.9`). At that point this
directory is deleted, not migrated. Do not build on it.
