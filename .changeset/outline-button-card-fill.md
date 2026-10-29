---
"@elmeragroup/fuse": patch
---

The outline `Button` rests on the `card` fill rather than the page fill, and so do the default
`Alert`'s action button, which copies it, and the `DataTableFilter` chip, which sits beside the
outline Trigger.

- External light themes tint the page, and on fkas private and guen the tint is darker than
  `muted`, so hovering an outline Button there lightened it toward grey, where every other theme
  darkens it. `card` is white in every light theme, so the `muted` hover now darkens it on every
  brand.
- Inside a Card on an external light page, an outline Button no longer shows the page tint through
  the card. It matches the card.
- The parts that render the outline variant follow: the current Pagination page, the Toast action,
  the Dialog and Sheet footer Close, the DataTable pagination moves and column toggle, and the
  DataTableFilter Trigger and its Clear outside the bar.
- In dark, `card` sits between the page and `muted`, so an outline Button rests one step lighter
  than the page, and its hover still lightens it, one step less than before. Tabs made the same
  trade-off.
- Internal dark paints `card-soft` and `muted` the same tone, so on a `card-soft` panel an outline
  Button rests darker than the panel and its hover matches the panel. It rested darker there
  before too, on the page fill.
