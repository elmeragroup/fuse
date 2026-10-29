---
"@elmeragroup/fuse": patch
---

`Focusable` from `@elmeragroup/fuse/react-aria/focusable` now passes every prop that is not a
focus option on to its child, merged with the child's own props. Used as a `Tooltip.Trigger`
`render` target, its child now carries the trigger's `data-slot`, its `aria-describedby` that
points at the open tooltip, and its handlers. Before, `Focusable` passed only its focus props to
the child and dropped the rest. Its child also gets `data-focusable-child=""`, and the
`@elmeragroup/fuse/theme-catalog` density table declares a tooltip trigger with that attribute
`fixed`, since inline text reads no control metric.
