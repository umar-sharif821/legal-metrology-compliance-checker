# OCR benchmark

A deliberately hard case, used to settle recognition decisions with measurements instead
of intuition. The synthetic labels elsewhere in this repo are too clean to distinguish
one setting from another — two earlier tuning attempts showed "no difference" purely
because the test image was easy.

Two cases, because they disagree and that is the point:

- `mk.html` — one panel under perspective rotation, glare, low contrast and blur.
  Screenshot at 1500x1100 to produce `hard1.png`.
- `mk2.html` — a real snack-packet layout: a dense nutrition table beside the
  declarations, i.e. two genuine columns. Screenshot at 1500x1000 to produce `hard2.png`.

Screenshot them with:

```bash
chrome --headless=new --window-size=1500,1100 --virtual-time-budget=3000 \
  --screenshot=bench/hard1.png file:///<abs-path>/bench/mk.html
```

Then, from the repository root:

```bash
node dashboard/bench/matrix.mjs   # preprocessing x page-segmentation matrix
node dashboard/bench/psm.mjs      # page-segmentation mode against the demo specimens
```

## What these runs established

- **Neither page-segmentation mode wins.** On the single upscaled panel the default
  returned zero lines while single-block returned 6/10; on the two-column packet the
  default scored 8/10 against single-block's 7/10. Choosing one was a mistake made on
  test images that only ever had one block. Both now run as candidates.
- **Upscaling before recognition helps.** 1500px to 3000px took 5/10 to 6/10.
- **Grayscale and contrast stretching actively destroy the read** — 0/10 at every page
  segmentation mode. This is the one worth remembering: it is the obvious thing to try,
  it feels like it should help, and it is much worse than doing nothing.

Derived images are not committed; regenerate them.

## PaddleOCR was tried, and lost — do not repeat this

Plan `T-3.3` names PaddleOCR as an intended OCR adapter, and on paper it should beat
Tesseract here: PP-OCR is a detector plus a recogniser trained on photographs, which is
exactly the case Tesseract is weakest on. It was integrated behind a feature flag,
measured, and removed. The reason is specific and worth knowing before anyone spends a
night on it again.

`@paddle-js-models/ocr` ships **only the Chinese recognition model**
(`ch_PP-OCRv3_rec_infer_js`). Chinese does not separate words with spaces, so the model
does not emit them. On the two-column benchmark it read:

    "NETQUANTITV1SOS"        <- NET QUANTITY: 150 g
    "DATEOFMANUFACTURE"      <- correct characters, no spaces at all
    "：15JL2026"              <- full-width Chinese colon
    "山RTONALMFORNAIONAPROK"  <- Chinese characters hallucinated onto a noisy region

Detection was good — it found the right regions. Recognition was unusable for this
project, because **every anchor in the rule pack is a spaced English phrase**:
`net quantity`, `manufactured by`, `customer care`. A run-together token matches none of
them. Result: 14 lines detected, **0 of 6 declarations located**, against 4 of 6 for
Tesseract on the same image.

There is no English model in PaddleJS format on the CDN — `en_PP-OCRv3_rec_infer_js` and
its variants all return 404. Producing one means running the `paddlejs-converter` Python
toolchain over the upstream English inference model. That is the actual prerequisite for
this adapter, and it is a piece of work in its own right, not an afternoon's integration.

Two smaller obstacles, recorded because they cost time:

- The package's OpenCV dependency is an Emscripten build that expects a bare `Module`
  global. Under Vite's dependency pre-bundling the import throws
  `ReferenceError: Module is not defined`; declaring `window.Module = {}` before the app
  loads fixes it.
- It requires WebGL. Headless Chrome gives none by default — `--enable-unsafe-swiftshader
  --ignore-gpu-blocklist --enable-gpu` is the flag set that produces a context, which
  matters for measuring it in CI.

Speed was also poor: 8-9 seconds per image under software rendering, against about one
second for Tesseract. A real GPU would narrow that, but not enough to matter given the
recognition problem.

**Conclusion.** The seam works — swapping the recogniser touched one module and nothing
downstream. The engine behind it is the problem. Revisit when an English PP-OCR model
exists in PaddleJS format, or when the server-side adapter in `T-3.3` can run the real
PaddleOCR rather than a browser port.
