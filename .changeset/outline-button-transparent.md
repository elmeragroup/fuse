---
"@elmeragroup/fuse": patch
---

The outline `Button` rests transparent rather than on the page fill, so it shows the surface
beneath it: the page, a Card, a Dialog or a Popover. The `DataTableFilter` chip, which sits beside
the outline Trigger, rests transparent too.

- Inside a Card on an external light page, or inside a Card, Dialog, Sheet or Popover in dark, an
  outline Button no longer shows the page fill through the surface. It matches the surface.
- On the page it looks as before. On the fkas private and guen pages its `muted` hover still
  lightens it, as the ghost Button's does, until design settles a light `muted`.
- The parts that render the outline variant follow: the current Pagination page, the Toast action,
  the Dialog and Sheet footer Close, the DataTable pagination moves and column toggle, and the
  DataTableFilter Trigger and its Clear outside the bar.
- The default `Alert`'s action, which borrowed the page fill too, now rests transparent on the
  Alert's own fill and looks the same.
