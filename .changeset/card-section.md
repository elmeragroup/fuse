---
"@elmeragroup/fuse": minor
---

`Card.Section` splits a vertical card's body into stacked sections of equal weight, under one
optional `Card.Header`. Each section pads every side with the card's tier, so it follows the card's
`size`, and a 1px line runs above every section that has a part above it, from edge to edge. The
first and last sections round with the card's corners, so a fill or a hover fill follows them, and
hidden sections are skipped. `Card.SectionMedia` adds an icon column, centred beside a
`Card.Content`, which is the unpadded content column inside a section. `Card.Section` is a static,
server-rendered part.

`Card.SectionButton` makes a whole section one `<button type="button">`, with a hover fill, a pointer
cursor, the disabled face and an inset focus ring. `render={<a href="…" />}` makes it a link, and a
trigger composes it as it composes `Button`: `<Dialog.Trigger render={<Card.SectionButton />}>`.

The line between sections is a new colour role, `--card-section-divider`. Internal themes draw it in
`--border` and external themes in the page tint, `--background`, so a card reads as split into
segments. Override it where you override `--card-border`.
