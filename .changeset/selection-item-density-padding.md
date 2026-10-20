---
"@elmeragroup/fuse": patch
---

Selection items (`CheckboxItem`, `RadioItem` and `SelectionItem.Shell`) now pad inline with the
medium surface tier, `--surface-pad-md`, instead of a fixed 16px. They look the same at
comfortable density and pad 12px at dense, like Items and Accordion items, so their text lines up
with the parts beside them at both densities. Their inner corner follows the same tier.
