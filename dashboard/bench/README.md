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
