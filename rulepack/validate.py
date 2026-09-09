#!/usr/bin/env python3
"""Validate every rule pack against rulepack/schema/rulepack.schema.json.

Three passes, because a JSON Schema alone cannot express the whole contract:

1. meta       - the schema is itself a valid Draft 2020-12 schema.
2. schema     - every pack validates structurally.
3. references - cross-object integrity: ids resolve, table references are of the right
                kind, band tables are ordered and open-topped, regexes compile. Plan
                section 15.4 requires that an unknown id fails the build, and no schema
                keyword can check that.

It also runs the schema's own negative suite (schema/examples/rejections.json), so the
gate proves what the schema refuses and not only what it accepts.

    python rulepack/validate.py [--quiet]

Exit 0 when clean, 1 on any failure. Owned by the pack rather than by either evaluator:
it needs nothing but `jsonschema`, and both runtimes are downstream of it.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

RULEPACK_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = RULEPACK_DIR / "schema" / "rulepack.schema.json"
EXAMPLES_DIR = RULEPACK_DIR / "schema" / "examples"
VALID_EXAMPLES_DIR = EXAMPLES_DIR / "valid"
REJECTIONS_PATH = EXAMPLES_DIR / "rejections.json"

# Check parameters that name a table, and the table kind each one requires. A unit check
# pointed at a phrase set would validate structurally and then silently never fire.
TABLE_PARAM_KINDS = {
    "unit_table": "unit_set",
    "phrase_table": "phrase_set",
    "table": "band_lookup",
}

# Check parameters that name a field in the pack's own field vocabulary.
FIELD_PARAMS_SINGLE = ("left_field", "field_a", "field_b")
FIELD_PARAMS_LIST = ("right_fields", "fields")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def build_validator() -> Draft202012Validator:
    """Load the schema and meta-validate it. Raises if the schema itself is malformed."""
    schema = load_json(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _leaf_messages(error: Any) -> Iterator[str]:
    """Flatten a validation error to its most specific messages.

    oneOf/anyOf report a useless summary at the top and the real reasons in `context`,
    so an unflattened report would say only "is not valid under any of the given
    schemas" for every malformed predicate.
    """
    if error.context:
        for sub in error.context:
            yield from _leaf_messages(sub)
    else:
        location = "/" + "/".join(str(part) for part in error.absolute_path)
        yield f"{location}: {error.message}"


def schema_errors(validator: Draft202012Validator, pack: Any) -> list[str]:
    errors: list[str] = []
    for error in sorted(validator.iter_errors(pack), key=lambda e: list(e.absolute_path)):
        errors.extend(_leaf_messages(error))
    return errors


def _duplicates(values: list[str]) -> list[str]:
    seen: set[str] = set()
    dupes: list[str] = []
    for value in values:
        if value in seen and value not in dupes:
            dupes.append(value)
        seen.add(value)
    return dupes


def _predicate_leaves(node: Any) -> Iterator[dict[str, Any]]:
    if not isinstance(node, dict):
        return
    for key in ("all", "any"):
        if key in node:
            for child in node[key]:
                yield from _predicate_leaves(child)
            return
    if "not" in node:
        yield from _predicate_leaves(node["not"])
        return
    if "var" in node:
        yield node


def _effects(gate: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for key in ("when_true", "when_false"):
        effect = gate.get(key)
        if isinstance(effect, dict):
            yield effect
    indeterminate = gate.get("indeterminate")
    if isinstance(indeterminate, dict):
        effect = indeterminate.get("default_effect")
        if isinstance(effect, dict):
            yield effect


def reference_errors(pack: dict[str, Any]) -> list[str]:
    """Cross-object integrity. Assumes the pack already passed the schema pass."""
    errors: list[str] = []

    fields = pack.get("fields", [])
    gates = pack.get("applicability_gates", [])
    declarations = pack.get("declarations", [])
    geometry_rules = pack.get("geometry_rules", [])
    tables = pack.get("tables", [])
    lexicons = pack.get("lexicons", [])

    field_ids = [f["id"] for f in fields]
    declaration_ids = [r["id"] for r in declarations]
    rule_ids = declaration_ids + [r["id"] for r in geometry_rules]
    table_kinds = {t["id"]: t["kind"] for t in tables}
    lexicon_ids = {lex["id"] for lex in lexicons}
    known_fields = set(field_ids)

    for label, values in (
        ("field id", field_ids),
        ("rule id", rule_ids),
        ("table id", [t["id"] for t in tables]),
        ("lexicon id", [lex["id"] for lex in lexicons]),
        ("gate id", [g["id"] for g in gates]),
    ):
        for dupe in _duplicates(values):
            errors.append(f"duplicate {label}: {dupe!r}")

    for dupe in _duplicates([str(g["order"]) for g in gates]):
        errors.append(f"two gates share order {dupe} - evaluation order must be total")

    tags_declared = {tag for rule in declarations + geometry_rules for tag in rule.get("tags", [])}

    for rule in declarations + geometry_rules:
        where = f"rule {rule['id']!r}"

        if "field" in rule and rule["field"] not in known_fields:
            errors.append(f"{where}: unknown field {rule['field']!r}")

        for field_id in rule.get("evidence_fields", []):
            if field_id not in known_fields:
                errors.append(f"{where}: evidence_fields names unknown field {field_id!r}")

        params = rule.get("check", {}).get("params", {})

        for param in FIELD_PARAMS_SINGLE:
            value = params.get(param)
            if isinstance(value, str) and value not in known_fields:
                errors.append(f"{where}: {param} names unknown field {value!r}")

        for param in FIELD_PARAMS_LIST:
            for value in params.get(param, []) or []:
                if value not in known_fields:
                    errors.append(f"{where}: {param} names unknown field {value!r}")

        for param, required_kind in TABLE_PARAM_KINDS.items():
            table_id = params.get(param)
            if not isinstance(table_id, str):
                continue
            if table_id not in table_kinds:
                errors.append(f"{where}: {param} names unknown table {table_id!r}")
            elif table_kinds[table_id] != required_kind:
                errors.append(
                    f"{where}: {param} names table {table_id!r} of kind "
                    f"{table_kinds[table_id]!r}, but this check requires kind "
                    f"{required_kind!r}"
                )

        lexicon_id = params.get("lexicon")
        if isinstance(lexicon_id, str) and lexicon_id not in lexicon_ids:
            errors.append(f"{where}: unknown lexicon {lexicon_id!r}")

        pattern = params.get("pattern")
        if isinstance(pattern, str):
            try:
                re.compile(pattern)
            except re.error as exc:
                errors.append(f"{where}: {pattern!r} is not a valid regular expression ({exc})")

        errors.extend(
            f"{where}: {message}"
            for message in _predicate_reference_errors(rule.get("applies_when"), lexicon_ids)
        )

    for gate in gates:
        where = f"gate {gate['id']!r}"
        errors.extend(
            f"{where}: {message}"
            for message in _predicate_reference_errors(gate.get("test"), lexicon_ids)
        )
        for effect in _effects(gate):
            for rule_id in effect.get("declarations", []):
                if rule_id not in declaration_ids:
                    errors.append(f"{where}: unknown declaration {rule_id!r}")
            for tag in effect.get("tags", []):
                if tag not in tags_declared:
                    errors.append(f"{where}: unknown tag {tag!r} - no rule carries it")

    for table in tables:
        if table["kind"] == "band_lookup":
            errors.extend(f"table {table['id']!r}: {m}" for m in _band_errors(table["bands"]))

    return errors


def _predicate_reference_errors(predicate: Any, lexicon_ids: set[str]) -> list[str]:
    errors: list[str] = []
    for leaf in _predicate_leaves(predicate):
        if leaf.get("op") == "matches_lexicon" and leaf.get("value") not in lexicon_ids:
            errors.append(f"unknown lexicon {leaf.get('value')!r}")
        if leaf.get("op") == "matches":
            try:
                re.compile(str(leaf.get("value")))
            except re.error as exc:
                errors.append(f"{leaf.get('value')!r} is not a valid regular expression ({exc})")
    return errors


def _band_errors(bands: list[dict[str, Any]]) -> list[str]:
    """A band table must be ascending, with exactly one open-ended band, placed last."""
    errors: list[str] = []
    bounds = [band["max"] for band in bands]

    finite = [b for b in bounds if b is not None]
    if finite != sorted(finite) or len(set(finite)) != len(finite):
        errors.append("bands are not in strictly ascending order of 'max'")

    open_positions = [i for i, bound in enumerate(bounds) if bound is None]
    if not open_positions:
        errors.append("no open-ended band (exactly one band must carry max: null)")
    elif len(open_positions) > 1:
        errors.append("more than one open-ended band (max: null)")
    elif open_positions[0] != len(bounds) - 1:
        errors.append("the open-ended band (max: null) must be last")

    return errors


def pending_notes(pack: dict[str, Any]) -> list[str]:
    """Declared-but-absent lexicon files. Not yet an error - they are authored at T-2.5."""
    notes: list[str] = []
    for lexicon in pack.get("lexicons", []):
        if not (RULEPACK_DIR / lexicon["path"]).is_file():
            notes.append(
                f"lexicon {lexicon['id']!r} declares {lexicon['path']} which does not exist yet"
            )
    return notes


def validate_pack(
    validator: Draft202012Validator, pack: Any, *, expect_id: str | None = None
) -> tuple[list[str], list[str]]:
    """Return (errors, pending). The referential pass runs only on a schema-clean pack."""
    errors = schema_errors(validator, pack)
    if errors:
        return errors, []

    errors = reference_errors(pack)
    if expect_id is not None and pack["metadata"]["id"] != expect_id:
        errors.append(
            f"metadata.id {pack['metadata']['id']!r} does not match the filename stem {expect_id!r}"
        )
    return errors, pending_notes(pack)


# --------------------------------------------------------------- the rejection suite


def _resolve_parent(document: Any, pointer: str) -> tuple[Any, str]:
    tokens = [t.replace("~1", "/").replace("~0", "~") for t in pointer.split("/")[1:]]
    node = document
    for token in tokens[:-1]:
        node = node[int(token)] if isinstance(node, list) else node[token]
    return node, tokens[-1]


def apply_mutation(document: Any, mutation: dict[str, Any]) -> None:
    node, key = _resolve_parent(document, mutation["path"])
    if isinstance(node, list):
        if mutation["op"] == "delete":
            del node[int(key)]
        elif key == "-":
            node.append(mutation["value"])
        else:
            node[int(key)] = mutation["value"]
    elif mutation["op"] == "delete":
        del node[key]
    else:
        node[key] = mutation["value"]


def run_rejection_suite(validator: Draft202012Validator) -> list[str]:
    suite = load_json(REJECTIONS_PATH)
    base = load_json(EXAMPLES_DIR / suite["base"])
    failures: list[str] = []

    for case in suite["cases"]:
        pack = copy.deepcopy(base)
        for mutation in case["mutations"]:
            apply_mutation(pack, mutation)

        found_schema = schema_errors(validator, pack)
        stage, needle = case["stage"], case["contains"]

        if stage == "schema":
            reported = found_schema
        elif found_schema:
            failures.append(
                f"{case['name']}: declared stage 'references' but the schema pass already "
                f"rejects it, so the referential pass is untested ({found_schema[0]})"
            )
            continue
        else:
            reported = reference_errors(pack)

        if not reported:
            failures.append(f"{case['name']}: accepted, but must be rejected ({case['why']})")
        elif not any(needle in message for message in reported):
            failures.append(
                f"{case['name']}: rejected for the wrong reason - expected a message "
                f"containing {needle!r}, got {reported}"
            )

    return failures


# ------------------------------------------------------------------------------ main


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="print only failures")
    args = parser.parse_args(argv)

    lines: list[str] = []
    failed = False

    try:
        validator = build_validator()
    except Exception as exc:
        print(f"FAIL  schema is not a valid Draft 2020-12 schema: {exc}", file=sys.stderr)
        return 1
    schema_name = SCHEMA_PATH.relative_to(RULEPACK_DIR.parent).as_posix()
    lines.append(f"ok    {schema_name} is a valid schema")

    packs = sorted(RULEPACK_DIR.glob("*.json"))
    if not packs:
        lines.append(
            "NOT YET  no rule pack exists in rulepack/*.json - the first one is T-1.3. "
            "The schema is exercised by schema/examples/ until then."
        )
    for path in packs:
        errors, pending = validate_pack(validator, load_json(path), expect_id=path.stem)
        failed = failed or bool(errors)
        lines.append(_report(path, errors, pending))

    for path in sorted(VALID_EXAMPLES_DIR.glob("*.json")):
        errors, pending = validate_pack(validator, load_json(path))
        failed = failed or bool(errors)
        lines.append(_report(path, errors, pending))

    rejection_failures = run_rejection_suite(validator)
    failed = failed or bool(rejection_failures)
    if rejection_failures:
        lines.append(f"FAIL  rejection suite: {len(rejection_failures)} case(s) misbehaved")
        lines.extend(f"        - {failure}" for failure in rejection_failures)
    else:
        suite = load_json(REJECTIONS_PATH)
        lines.append(f"ok    rejection suite: {len(suite['cases'])} case(s) correctly refused")

    for line in lines:
        if not args.quiet or line.startswith(("FAIL", "        ")):
            print(line)

    return 1 if failed else 0


def _report(path: Path, errors: list[str], pending: list[str]) -> str:
    name = path.relative_to(RULEPACK_DIR.parent).as_posix()
    if errors:
        detail = "\n".join(f"        - {message}" for message in errors)
        return f"FAIL  {name}: {len(errors)} problem(s)\n{detail}"
    note = ""
    if pending:
        detail = "\n".join(f"        ! {message}" for message in pending)
        note = f"\n{detail}"
    return f"ok    {name}{note}"


if __name__ == "__main__":
    sys.exit(main())
