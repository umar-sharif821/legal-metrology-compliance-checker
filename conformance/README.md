# Conformance suite

Fixtures that **both** evaluators must agree on, byte for byte. This is the gate that
lets the project claim, without qualification, that the offline verdict and the server
verdict are the same verdict (plan §15.4).

Nothing here yet — the suite is `T-1.9`, and it needs the rule pack (`T-1.2`–`T-1.5`)
and both evaluators (`T-1.7`, `T-1.8`) first.

When it lands:

```
fixtures/*.json      input field set → expected verdict
run_ts.ts            TypeScript runner
run_py.py            Python runner
```

The CI job `conformance` in `.github/workflows/ci.yml` is a visible no-op until then;
it prints a NOT IMPLEMENTED notice rather than passing silently (P9).

**Working agreement:** every behaviour change to either evaluator adds a fixture here.
Editing one evaluator without the other breaks this gate — that is the point of it.
