---
"@elmeragroup/fuse": minor
---

`Frame.Root` takes a `layout` prop: `"gutter"` (the default) keeps a 4px muted gutter between
panels, `"stacked"` fuses adjacent panels into one card, and `"flush"` drops the Frame's padding so
its panels and Tables run to its edges and round with its own corner, with the header and footer in
its muted band. `@elmeragroup/fuse/frame` exports the union as `FrameLayout`. The Frame now draws
a 1px border, and its panels round concentrically inside it. `Frame.Header` and `Frame.Footer` pad
half the panel padding on the block axis, so they read as bars above and below the panels. Every
text column in a Frame starts and ends on one inset, a panel's border and padding: the header and
a header's collapsible trigger, the panels, the footer, and a framed Table's first and last columns
and its caption, which now aligns to the start in a Frame. `Table.Head` aligns its text to the
start, and `VerticalTable` draws its key divider on the logical end side, so both hold in
right-to-left layouts.

A panel or Table in a `Collapsible.Content` of a `Collapsible.Root` that is the Frame's direct child
keeps the Frame's corner and layout, so panels can collapse. A `Collapsible.Trigger` directly in
`Frame.Header` takes the whole band: it pads as the header does, draws the focus ring inside the
band, and turns a trailing caret half a turn while its panel is open. The collapsible panel keeps
its shadow: in a Frame, `Collapsible.Content` clips to its animating height with a clip-path that
leaves room for the shadow. A panel in any other wrapper, such as a `div`, is a plain panel.

A Table inside a `Frame.Panel` now renders as a plain table, without the framed cell borders. A
panel whose only child is a `Table.Root` or `VerticalTable.Body` element drops its padding and
writes `data-sole-table="true"`: the table runs to the panel's edges and clips to its corners, a
`VerticalTable.Body` there drops its own border for the panel's, and the table's first and last
columns take over the padding. Anything else keeps the padding, including text beside the table
and a component that renders a table. Only a Table that is the Frame's own child, directly or in
such a `Collapsible.Content`, keeps the framed look.

Breaking: `stackedPanels` is removed. Replace `stackedPanels` with `layout="stacked"`; the type
checker flags the old prop. A Table in a panel loses the framed cell borders it took before, and a
panel whose only child is a Table element loses its padding.
