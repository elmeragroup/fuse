---
"@elmeragroup/fuse": patch
---

The outline `Button` rests on the `card` fill rather than the page fill, and so does the default
`Alert`'s action button, which copies it.

- External light themes tint the page, and on fkas private and guen the tint is darker than
  `muted`, so hovering an outline Button there lightened it toward grey, where every other theme
  darkens it. `card` is white in every light theme, so the `muted` hover now darkens it on every
  brand.
- Inside a Card on an external light page, an outline Button no longer shows the page tint through
  the card. It matches the card.
- In dark, `card` sits between the page and `muted`, so an outline Button rests one step lighter
  than the page, and its hover still lightens it, one step less than before. Tabs made the same
  trade-off.
