---
"@elmeragroup/fuse": patch
---

A size utility in your `className` now wins on `Select.Trigger` and on a segmented `ToggleGroup.Item`
(`spacing={0}`), as it already did on `Button` and `Toggle`. Before, the trigger's height, gap,
padding and type and the segmented item's padding sat behind heavier `data-*` selectors, so
`<Select.Trigger className="h-12">` or `<ToggleGroup.Item className="px-4">` changed nothing.
Without a `className`, both render as before.
