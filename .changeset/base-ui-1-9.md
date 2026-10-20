---
"@elmeragroup/fuse": patch
---

Fuse now pins Base UI 1.9.0. These Base UI changes reach Fuse components:

- A `Select` or `Combobox` given `actionsRef` now unmounts its popup after the close animation
  on its own. To keep it mounted until you call `actionsRef.current.unmount()`, call
  `eventDetails.preventUnmountOnClose()` in `onOpenChange`.
- `Select` and `Combobox` accept readonly arrays as `multiple` values.
- `DropdownMenu.Root` takes Base UI's `onItemHighlighted` callback.
- An `aria-label` on a `Checkbox`, a `Switch` or a radio item now names the control ahead of an
  associated label.
- `ScrollArea`'s viewport no longer carries `role="presentation"`.
- `Accordion` and `Collapsible` triggers render the native `disabled` attribute when disabled.
- A touch tap on a `Slider` track now fires Base UI's commit, and a drag ends on `touchcancel`
  and `pointercancel`.

`Command` still sends the highlight back to the first match on each opening, including one that
interrupts the close animation.
