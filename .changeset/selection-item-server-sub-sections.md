---
"@elmeragroup/fuse": patch
---

A `SelectionItem.SubSection` written in a server component now renders outside its row's label.
Before, a server component that rendered `SelectionItem.Shell` with direct `SubSection` children,
or a client component that rendered `CheckboxItem` or `RadioItem` around `SubSection` children a
server component passed it, put the band inside the label: its text joined the control's accessible
name and a click on it toggled the control. `SelectionItem.SubSection`, and so
`CheckboxItem.SubSection` and `RadioItem.SubSection`, is now a server component, and its root
carries `data-selection-item-sub-section`. A `SubSection` with no children no longer opens an empty
band under the row.
