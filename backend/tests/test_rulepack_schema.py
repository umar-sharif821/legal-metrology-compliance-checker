"""The rule-pack schema gate (T-1.2, plan section 15.4).

`rulepack/validate.py` is the command CI runs; these tests are the same checks with
per-case names, so a failure says which invariant broke rather than only that one did.

The validator lives beside the pack it validates rather than inside either evaluator,
so it is loaded by path.
"""

from __future__ import annotations

import copy
import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
VALIDATE_PATH = REPO_ROOT / "rulepack" / "validate.py"

_spec = importlib.util.spec_from_file_location("rulepack_validate", VALIDATE_PATH)
assert _spec is not None and _spec.loader is not None
validate = importlib.util.module_from_spec(_spec)
sys.modules["rulepack_validate"] = validate
_spec.loader.exec_module(validate)


@pytest.fixture(scope="module")
def validator() -> Any:
    return validate.build_validator()


@pytest.fixture(scope="module")
def rejection_suite() -> dict[str, Any]:
    return validate.load_json(validate.REJECTIONS_PATH)


def _case_ids(suite: dict[str, Any]) -> list[str]:
    return [case["name"] for case in suite["cases"]]


def test_schema_is_a_valid_draft_2020_12_schema(validator: Any) -> None:
    assert validator is not None


def test_validate_script_exits_clean() -> None:
    """The exact command the CI gate runs."""
    assert validate.main(["--quiet"]) == 0


@pytest.mark.parametrize(
    "example",
    sorted(validate.VALID_EXAMPLES_DIR.glob("*.json")),
    ids=lambda p: p.stem,
)
def test_valid_examples_are_accepted(validator: Any, example: Path) -> None:
    errors, _pending = validate.validate_pack(validator, validate.load_json(example))
    assert errors == []


def _rejection_cases() -> list[Any]:
    suite = validate.load_json(validate.REJECTIONS_PATH)
    return suite["cases"]


@pytest.mark.parametrize("case", _rejection_cases(), ids=[c["name"] for c in _rejection_cases()])
def test_schema_refuses_what_it_must(validator: Any, case: dict[str, Any]) -> None:
    """Each case mutates the minimal pack one way and must be rejected for its stated reason.

    Asserting on the message, not merely on rejection, keeps a case from passing because
    something unrelated broke.
    """
    suite = validate.load_json(validate.REJECTIONS_PATH)
    pack = copy.deepcopy(validate.load_json(validate.EXAMPLES_DIR / suite["base"]))
    for mutation in case["mutations"]:
        validate.apply_mutation(pack, mutation)

    schema_found = validate.schema_errors(validator, pack)
    if case["stage"] == "schema":
        reported = schema_found
    else:
        assert schema_found == [], (
            f"{case['name']} claims to test the referential pass, but the schema pass "
            f"already rejects it, so the referential check is never reached"
        )
        reported = validate.reference_errors(pack)

    assert reported, f"accepted, but must be rejected: {case['why']}"
    assert any(case["contains"] in message for message in reported), (
        f"rejected for the wrong reason - expected {case['contains']!r}, got {reported}"
    )


def test_validator_is_not_vacuously_green(validator: Any) -> None:
    """A validator that accepts everything would make every test above pass."""
    errors, _pending = validate.validate_pack(validator, {"schema_version": "nonsense"})
    assert errors


def test_every_rejection_case_is_distinct(rejection_suite: dict[str, Any]) -> None:
    names = _case_ids(rejection_suite)
    assert len(names) == len(set(names))


def test_real_packs_validate() -> None:
    """Guards the packs themselves once T-1.3 lands. Vacuous until then, and says so."""
    validator = validate.build_validator()
    packs = sorted(validate.RULEPACK_DIR.glob("*.json"))
    if not packs:
        pytest.skip("no rule pack exists yet - the first one is T-1.3")
    for path in packs:
        errors, _pending = validate.validate_pack(
            validator, validate.load_json(path), expect_id=path.stem
        )
        assert errors == [], f"{path.name}: {errors}"
