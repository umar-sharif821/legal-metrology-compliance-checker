# OCR benchmark

A deliberately hard case, used to settle recognition decisions with measurements instead
of intuition. The synthetic labels elsewhere in this repo are too clean to distinguish
one setting from another — two earlier tuning attempts showed "no difference" purely
because the test image was easy.

`mk.html` renders a label under perspective rotation, glare, low contrast and slight
blur. Screenshot it at 1500x1100 to produce `hard1.png`:

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

- **Page segmentation mode 6 beats the default everywhere tested.** On the upscaled
  benchmark the default returned zero lines; mode 6 returned 6/10 target strings. On
  specimen 3 the default returned nothing and mode 6 found three declarations.
- **Upscaling before recognition helps.** 1500px to 3000px took 5/10 to 6/10.
- **Grayscale and contrast stretching actively destroy the read** — 0/10 at every page
  segmentation mode. This is the one worth remembering: it is the obvious thing to try,
  it feels like it should help, and it is much worse than doing nothing.

Derived images are not committed; regenerate them.
