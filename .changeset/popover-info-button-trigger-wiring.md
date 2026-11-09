---
"@elmeragroup/fuse": patch
---

`PopoverInfoButton` now passes its state, ARIA, handler and `disabled` props to
`Popover.Trigger` and keeps the Button's presentation props and `disabled` on the Button. Before, every
prop landed on the Button, whose props beat the trigger's, so a forwarded
`aria-expanded={undefined}` erased the open trigger's `aria-expanded="true"`, and `disabled`
reached the Button but not `Popover.Trigger`. `className` and `style` callbacks still read the
Button's state, so a pending button and a disabled non-native trigger report `disabled`, and a
disabled `focusableWhenDisabled` trigger stays in the Tab order.
