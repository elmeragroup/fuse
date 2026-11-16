---
"@elmeragroup/fuse": patch
---

Overlays now reverse when they are opened or closed mid-transition. Popover, Select, Combobox,
Autocomplete, DropdownMenu, Tooltip, Dialog, AlertDialog, `Command.Content`, the chart tooltips
other than `LiveLineChart.Tooltip`, and the data table filter's menus open and close with CSS
transitions, so a close during the opening, or an opening during the close, eases back from where
the popup is. Before, the popup jumped to the start of its other animation. Dialog's backdrop
reverses with its popup. The look is unchanged: the same fade, 95% zoom, entry slide from the
trigger's side and durations. A popup that is already open when it mounts, such as one with
`defaultOpen` or a Root first rendered with `open` set, now appears at rest without an entrance
animation. Under reduced motion the popups still only fade.
