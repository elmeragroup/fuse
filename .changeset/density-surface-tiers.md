---
"@elmeragroup/fuse": minor
---

Density now sets shell padding as well as control sizes. Three surface metrics,
`--surface-pad-sm`, `--surface-pad-md` and `--surface-pad-lg`, sit beside the `--control-*`
metrics: 4/4px, 12/16px and 16/24px dense/comfortable. Each shell pads with one tier and
subtracts the same tier from the inner corner it publishes. Outer corners do not change.

- Small: DropdownMenu, Select groups, Combobox lists and Frame keep 4px. NavigationMenu
  content, the floating Sidebar's sections, Calendar, the DateRangePicker's calendar and the
  date-picker presets pad 4px instead of 8px. A floating Sidebar collapsed to icons keeps 8px.
- Medium: Popover (PopoverInfoButton's too), Toast, every Accordion item and Item's default
  inline padding pad 12px dense, down from 16px, and 16px comfortable. The Field label card
  stays 12px dense and grows to 16px comfortable.
- Large: Card sections, the gaps between them and a horizontal Card's gap, Dialog, and Empty
  pad 16px dense, down from 24px, and 24px comfortable. Frame panels pad 16px dense and 24px
  comfortable, from 20px. Frame headers and footers change only their inline padding, 16px
  dense and 24px comfortable from 20px; their block padding stays 16px. Empty pads 32px dense
  and 48px comfortable from `md` up, where it padded 48px. The TextField `card` box pads 16px
  dense and 24px comfortable inline, from 24px. CheckboxCard stays 16px dense inline and grows
  to 24px comfortable.

Menu, Select, Combobox, NavigationMenu and default Sidebar rows read the row metrics,
`--row-h` and `--row-px`. They stay 32px tall with 8px inline padding when dense
and become 36px with 12px when comfortable. The Sidebar menu skeleton matches the default row.
The Figma density collection gains the three surface metrics.
