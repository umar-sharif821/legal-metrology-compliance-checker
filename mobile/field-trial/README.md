# Field-trial corpus — demo phase `D-3`

Each `NNN-<slug>.json` here is one real packet, recorded on the device by the **Record**
control on the verdict screen and pulled with `scripts/pull-field-trial.sh`.

Since `C-0` a record can come from a photo taken with the stock camera app: photograph
ten packets, then feed them in with **Use a photo from the gallery** and record each one.
That is the intended way to fill this directory — holding a packet in front of a live
scan and hoping the pass lands was what left `D-3` stuck at two.

The JSON holds the raw OCR lines the packet produced, with their boxes. That is a
measurement, not a guess: once the packet is off the desk those exact lines cannot be
obtained again, which is why they are committed.

## `source` — read this before comparing two records

Every record declares where its image came from, and the three kinds are **not
interchangeable measurements of the same packet**:

| `source` | What it was |
|---|---|
| `viewfinder` | A live loop pass, `skipProcessing: true` — no autofocus settle, no HDR. Pre-`C-0` records are all this. |
| `still` | A full-quality capture the operator asked for. |
| `upload` | A photo taken with the stock camera app. The best input the app can be given. |

Two records of one packet with different sources will disagree, and that disagreement is
data rather than a bug. `timings.captureMs` is `null` for an `upload` — there is no
shutter this app timed, and a zero there would join any latency average silently (P4).

Records 001 and 002 were written before `C-0` and were annotated with
`"source": "viewfinder"` when the field was added. Nothing else in them was touched.

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
