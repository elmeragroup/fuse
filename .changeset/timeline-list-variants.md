---
"@elmeragroup/fuse": minor
---

`TimelineList` composes each event from parts, and gains layouts, sizes and statuses.

- A `TimelineList.Item` now holds its parts in this order: an optional `TimelineList.Opposite`,
  a `TimelineList.Indicator` and a `TimelineList.Content`, which holds the `Title`, `Time` and
  `Description`.
  - `TimelineList.Indicator` draws the rail: the line in and out and the lane between. Without
    children it shows the default `TimelineList.Mark`; with `null` it shows no mark and the line
    runs on to the text; with a node, such as an `Avatar`, it shows that node in the lane. Size
    the node to the lane; a default `Avatar` needs `lg`. It is decorative and hidden from
    assistive technology unless it gets `aria-hidden={false}`.
  - `TimelineList.Mark` without children draws the Item's status. With children, such as an icon,
    it fills the lane in the status's colors, or on a muted fill without a status.
  - `TimelineList.Opposite` holds content across the rail from the body, such as a
    `TimelineList.Time`. An empty Opposite takes no room.
- `TimelineList.Root` takes `layout`: `vertical`, the default; `alternate`, with the body and the
  opposite content on either side of the rail, folding to one side under 32rem; and `horizontal`,
  which runs along the inline axis. Wrap a horizontal list in `ScrollArea.Root` with
  `orientation="horizontal"` so it scrolls when it is wider than its parent.
- `TimelineList.Root` takes `spacing="compact"` for less space between Items, and `indicatorSize`
  of `dot`, the default, `md` or `lg`, a 24px or 32px lane that every Item shares.
- `TimelineList.Item` takes `status`: `complete`, `current`, `upcoming` or `error`, each with its
  own mark. At `md` and `lg` the complete mark carries a check and the error mark a cross. The
  marks and glyphs show in forced-colors mode. `current` sets `aria-current="step"`. The other
  statuses add visually hidden text as the Item's first child, "Completed", "Upcoming" or "Error"
  in the reader's locale, which needs a `LocaleProvider`. `statusLabel`, which the types allow
  only beside `status`, replaces that text, and an empty `statusLabel` renders none. An Item
  without `status` keeps the 8.75px dot in an `md` or `lg` lane.

**Breaking:**

- An Item no longer draws a rail around its children. Put the Title, Time and Description in a
  `TimelineList.Content` beside a `TimelineList.Indicator`. Old markup still renders, but with no
  rail and no mark.
- The `timeline-list-dot` slot is gone. The default mark is `timeline-list-mark`, which carries
  the skeleton role, inside a `timeline-list-lane` in the `timeline-list-indicator`, between two
  `timeline-list-connector` segments. The connector is no longer the Item's `::before`. A host
  stylesheet that targeted the dot or the pseudo-element needs the new slots.
- The list no longer indents itself. The 24px start margin on each Item is gone, so the first rail
  starts at the list's start edge. Add a margin on `TimelineList.Root` to keep the old indent.
- The line now runs through the gap between Items, with a 4px gap above and below each mark, and
  the text starts 12px after the rail. Items are 32px apart, in place of 40px.
- `TimelineList.Root` writes `role="list"`, so Safari keeps the list semantics of the markerless
  list.
