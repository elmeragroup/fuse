---
"@elmeragroup/fuse": minor
---

`TimelineList` gains layouts, sizes and statuses.

- `TimelineList.Root` takes `layout`: `vertical`, the default; `alternate`, with the body and the
  `opposite` content on either side of the rail, folding to one side under 32rem; and
  `horizontal`, which runs along the inline axis. Wrap a horizontal list in `ScrollArea.Root`
  with `orientation="horizontal"` so it scrolls when it is wider than its parent.
- `TimelineList.Root` takes `spacing="compact"` for less space between Items, and `indicatorSize`
  of `dot`, the default, `md` or `lg`, a 24px or 32px lane that every Item shares.
- `TimelineList.Item` takes `status`: `complete`, `current`, `upcoming` or `error`, each with its
  own mark. At `md` and `lg` the complete mark carries a check and the error mark a cross. The
  marks and glyphs show in forced-colors mode. `current` sets `aria-current="step"`. The other
  statuses add visually hidden text, "Completed", "Upcoming" or "Error" in the reader's locale,
  which needs a `LocaleProvider`. `statusLabel`, which the types allow only beside
  `status`, replaces that text, and an empty `statusLabel` renders none. An Item without `status`
  keeps the 8.75px dot in an `md` or `lg` lane.
- `TimelineList.Item` takes `indicator`, a node such as an `Avatar` in place of the mark, or
  `null` for none, where the line runs through. The node is decorative and hidden from assistive
  technology.
- `TimelineList.Item` takes `opposite`, content such as a `TimelineList.Time` across the rail from
  the body. A vertical list then gives every Item a 7rem column before the rail.

**Breaking:**

- The markup of `TimelineList.Item` changes. Each Item holds an opposite cell when `opposite` is
  set, a `timeline-list-rail` with two `timeline-list-connector` segments around a
  `timeline-list-indicator`, and a `timeline-list-content` cell around its children. A plain
  vertical Item lays these out as a flex row, and the other layouts as a grid. The
  `timeline-list-dot` slot is gone; the default mark is `timeline-list-mark`, which also carries
  the skeleton role. The connector is no longer the Item's `::before`. A host stylesheet that
  targeted the dot or the pseudo-element needs the new slots.
- The list no longer indents itself. The 24px start margin on each Item is gone, so the first rail
  starts at the list's start edge. Add a margin on `TimelineList.Root` to keep the old indent.
- The line now runs through the gap between Items, with a 4px gap above and below each mark, and
  the text starts 12px after the rail. Items are 32px apart, in place of 40px.
- `TimelineList.Root` writes `role="list"`, so Safari keeps the list semantics of the markerless
  list.
