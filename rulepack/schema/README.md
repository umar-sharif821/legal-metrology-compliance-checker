# The rule-pack schema

`rulepack.schema.json` is the structural contract every pack in `rulepack/*.json` must
satisfy. Plan §4.5 and §5.2; the CI gate is §15.4.

Validate with:

```bash
python rulepack/validate.py
```

## What the schema is for

Two jobs, and it is worth keeping them apart when reading it.

1. **It holds the statutory facts out of the code.** Clause identifiers, thresholds,
   tables, lexicon names, applicability predicates and bilingual finding text all live in
   the pack (P6). Neither evaluator may hard-code any of them.
2. **It is the interpreter's vocabulary.** `check.kind`, `effect.kind` and the predicate
   operators are closed enums. A pack cannot name a check that no evaluator implements —
   an unknown kind fails the build instead of silently doing nothing.

Consequence: **adding a check kind is a schema change made together with both
evaluators**, plus a conformance fixture. That friction is the point.

## Invariants the schema itself enforces

These do not depend on anyone remembering them:

- A rule may only set `max_severity: violation` when its `provenance.status` is
  `REVIEWED`. `PENDING_LEGAL_REVIEW` and `DISPUTED` are capped at `advisory`, so an
  unverified threshold can never produce an accusation.
- A rule that can emit a violation must carry `evidence_fields` (P7).
- `REVIEWED` requires a named reviewer and a date; `PENDING_LEGAL_REVIEW` requires both
  to be `null`, so a reviewer's name never appears against something they did not sign.
- A `height_min_from_table` check must declare `requires_scale_reference: true`, and a
  `height_parity` check must declare `false` (P4). The schema fixes both values.
- An `exempt` effect must cite the exempting provision.
- A gate must state both branches.
- Every params object is closed, so a misspelled parameter fails rather than being
  ignored by both evaluators.

## What `validate.py` adds

JSON Schema cannot check cross-references, so the validator runs a second pass over a
schema-clean pack: ids resolve (fields, rules, tables, lexicons, tags), table references
are of the right kind, band tables are ascending with exactly one open-ended top band,
and regex parameters compile. §15.4's "unknown rule IDs fail the build" lives here.

It also runs `examples/rejections.json` — 26 mutations of `examples/valid/minimal.json`
that must each be refused, and refused *for the stated reason*. A schema is only as good
as what it turns away, and asserting on the message stops a case from passing because
something unrelated broke.

## The examples are fixtures, not rule packs

Everything under `examples/` uses the statute code `EXAMPLE`, clause numbers of the form
`0(1)(x)`, and reviewer names that say they are placeholders. Nothing there is a
statutory claim, and `validate.py` never treats these files as real packs — real packs are
`rulepack/*.json` only.

`examples/valid/full-featured.json` exercises every construct; use it as the reference
when writing `lmpc-2011.json`. `examples/valid/minimal.json` is the floor.

## Adding a pack

- Filename stem must equal `metadata.id` (`lmpc-2011.json` → `"id": "lmpc-2011"`).
- Everything legal starts at `PENDING_LEGAL_REVIEW` with `reviewed_by: null`.
- Where a clause reading is contested, record the competing citation under
  `clause.alternate_readings` rather than picking one silently. The MRP and date
  sub-clause letters are the live example — see the open question in `docs/PROGRESS.md`.
- The pack stores no hash of itself. The `sha256` in a verdict envelope is computed over
  the canonical serialisation at load time.
