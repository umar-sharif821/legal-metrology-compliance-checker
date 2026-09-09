# Regenerating the implementation plan PDF

The PDF is generated from `docs/IMPLEMENTATION_PLAN_v2.md`. Edit the markdown,
never the PDF, then rebuild:

    python docs/_build/render.py docs/IMPLEMENTATION_PLAN_v2.md \
                                docs/IMPLEMENTATION_PLAN_v2.pdf \
                                docs/_build/meta.json

Requires `reportlab`. Uses Calibri/Consolas from the Windows font directory when
available and falls back to Helvetica/Courier otherwise.

## Mini-markdown supported by the renderer

    # [SECTION n] Title    section heading (starts a new page)
    ## / ### / ####        sub-headings
    - item / 1. item       lists
    ```                    code / ASCII diagram block
    ~~~t|30,20,50          table; digits are relative column widths
    a | b | c              table row (first row is the header)
    ~~~
    :::change Title        callout box; also: note, keep, cut, add, warn, why
    :::
    <PB>                   explicit page break

Inline: `**bold**`, `*italic*`, backtick-code.
