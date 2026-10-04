---
"@elmeragroup/fuse": patch
---

`Select.Content` opens beside its trigger when an ancestor of its portal target, such as a
transformed one or one with `content-visibility: auto`, is the containing block for
`position: fixed` content. Item alignment writes viewport coordinates onto a `position: fixed`
popup, and such an ancestor offset that popup a second time, so the list opened away from its
trigger. When the content mounts, Fuse measures where fixed probes at two opposite corners land
in the portal target, and `alignItemWithTrigger` applies only when they land on the viewport's
corners. A shorter block at the viewport origin therefore falls back too. Query containers keep
item alignment. This also places the `DataTable` "Rows per page" list correctly
inside a transformed `ThemeScope`.

`Select.Content` also measures as the user opens it, so an ancestor a host transforms after the
page loads now places the list beside its trigger at the next open. A `Select` that opens from
its first render, through `defaultOpen` or `open`, waits for the first measurement before it
shows its list, and then aligns the selected item with the trigger on an ordinary page. Before,
it opened beside the trigger. `data-align-trigger` now always names the placement the list
actually has.

The react-aria fields' error message has `role="alert"`, like Fuse `Field`'s error. `DateField`,
`DatePicker`, `DateRangePicker` and `SearchField` now announce an error when it appears, and
`aria-describedby` still ties it to the field.

The calendars of `DatePicker` and `DateRangePicker` stay inside a `ThemeScope` or `container`
that clips its overflow. React Aria 3.52.1 mixes page and containing-block coordinates when it
measures the room around a popover in a positioned scope, so a calendar under a field near the
scope's bottom edge opened downward and lost its last rows. Inside a clipping portal target,
Fuse now measures the trigger and the visible part of the target as the calendar opens. It
opens the calendar below the field when it fits there, above it otherwise, and keeps its
alignment with the field. Other portal targets keep React Aria's placement.
