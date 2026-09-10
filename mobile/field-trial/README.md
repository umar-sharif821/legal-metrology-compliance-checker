# Field-trial corpus — demo phase `D-3`

Each `NNN-<slug>.json` here is one real packet, recorded on the device by the **Record**
control on the verdict screen and pulled with `scripts/pull-field-trial.sh`.

The JSON holds the raw OCR lines the packet produced, with their boxes. That is a
measurement, not a guess: once the packet is off the desk those exact lines cannot be
obtained again, which is why they are committed.

The matching `NNN-<slug>.jpg` is **not** committed — see `.gitignore`. Tuning changes
lexicons and shapes, which operate on lines, so the JSON alone is the replay corpus. The
image is only for looking at a packet again with your own eyes, and ten full-resolution
captures is tens of megabytes in a repo with no remote.

## Reviewing a record

`src/scan/corpus.test.ts` replays every record through the real `extract` → `evaluate`
path and **fails** on any record without an `expect` block. Pulling a record therefore
reds `npm test` until a person has looked at it. That is the point: an unreviewed record
is a log, not a fixture.

To review one, read its `lines`, decide what the app *should* make of them, and add:

```json
"expect": {
  "fields": {
    "net_quantity": "250 g",
    "mrp": "30.00",
    "commodity_name": null
  },
  "status": "ATTENTION",
  "findings": ["mrp_missing_tax_wording"],
  "notes": "Anchor and value are in separate columns; the MRP line omits the tax wording."
}
```

- A field mapped to a **string** must be extracted with exactly that value.
- A field mapped to **`null`** must *not* be extracted. This is a reviewer stating that
  the packet contains nothing that legitimately fills the field, so any value there is a
  false positive (P3).
- `findings` lists the declaration ids expected, in any order.

Then tune `src/rulepack/demo-lmpc-v0.json` until the suite is green — never the
TypeScript (P6). If a change to the pack fixes this packet and breaks an earlier one, the
suite says so immediately, which is the whole reason this directory exists.

The `verdict` and `extracted` blocks the device wrote are **descriptive** — what the app
did at record time. They are not the expectation and must not be copied into `expect`
without reading them first.
