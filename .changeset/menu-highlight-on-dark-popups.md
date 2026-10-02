---
"@elmeragroup/fuse": patch
---

Menu rows show their highlight on dark external popups. The external dark sheets for Fjordkraft,
Trøndelagkraft, Fjordkraft Sverige and Elmera set `primary-soft` to their card color, so `accent`
matched `popover` and a highlighted item in `Select`, `Combobox` or `DropdownMenu` looked like the
popup. A dark external theme whose sheet names no `accent` now lifts `popover` 8% toward
`foreground`, the step internal dark takes. This also changes Gudbrandsdal Energi's dark `accent`.

`NavigationMenu`: a link or vertical trigger inside a popup highlights with `accent` on hover and
while open, as other menus do. Bar triggers and bar links keep the `muted` highlight.
