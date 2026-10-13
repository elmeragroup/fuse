---
"@elmeragroup/fuse": minor
---

Add `Toolbar`, a bar of controls built on Base UI's toolbar. Import it from
`@elmeragroup/fuse/toolbar`. It has six parts: `Root`, `Button`, `Link`, `Input`, `Group` and
`Separator`. The bar is one Tab stop, and the arrow keys move between its items, wrapping at the
ends unless `loopFocus` is false. `Toolbar.Root` paints the bar: a bordered popover fill with
`p-1`, a column when `orientation="vertical"`. It publishes `--inner-corner`, so an item that
rounds with `rounded-inner` sits concentric in it. `Toolbar.Button`, `Toolbar.Link` and
`Toolbar.Input` have no look of their own and render the control that shows them, such as
`render={<Button variant="ghost" size="sm" />}`, a `Popover.Trigger` or a
`DropdownMenu.Trigger`. A ToggleGroup inside the bar joins its arrow-key order. A disabled item
stays focusable. `Toolbar.Separator` draws Separator's hairline across the bar.

`Popover.Content` takes `anchor`, the element, ref or virtual element the popup is placed
against in place of the trigger. A controlled popover with no trigger opens against it, and
the popup follows the anchor as it moves or resizes.
