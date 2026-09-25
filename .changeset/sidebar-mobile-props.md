---
"@elmeragroup/fuse": patch
---

`Sidebar.Root` on mobile now forwards its element props (`id`, `aria-*`, `data-*`, handlers)
to the sheet dialog and merges `style` with the mobile `--sidebar-width`; they were dropped on
the sheet's provider before. A caller's `Sidebar.Rail` `onClick` now runs alongside the toggle
instead of replacing it. The mobile breakpoint is `(width < 48rem)`, the exact complement of
`md:`, so fractional widths and non-16px browser default font sizes no longer leave a range with
no sidebar, and the Rail shows from `md:` instead of `sm:`, so it stays hidden inside the mobile sheet.
