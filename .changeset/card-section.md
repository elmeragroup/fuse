---
"@elmeragroup/fuse": minor
---

`Card.Section` splits a card into stacked sections of equal weight. Each section pads every side with
the card's tier, so it follows the card's `size`, and a 1px line runs between sections from edge to
edge. The first and last sections round with the card's corners, so a fill or a hover fill follows
them, and hidden sections are skipped. `Card.SectionMedia` adds an icon column, centred beside the
content. `render` makes a whole section a button or a link, with a hover fill, a pointer cursor and
an inset focus ring.

The line between sections is a new colour role, `--card-section-divider`. Internal themes draw it in
`--border` and external themes in the page tint, `--background`, so a card reads as split into
segments. Override it where you override `--card-border`.
