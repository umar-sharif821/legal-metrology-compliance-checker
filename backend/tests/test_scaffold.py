"""Proves the Python toolchain and pytest collection are wired.

Replaced by real evaluator tests at T-1.8 and by the conformance runner at T-1.9.
"""

import importlib


def test_backend_app_package_imports() -> None:
    assert importlib.import_module("backend.app") is not None
