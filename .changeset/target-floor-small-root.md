---
"@elmeragroup/fuse": patch
---

The smallest controls keep their 24px target when the host's root font size is 14px. Before, a
14px root shrank dense `Button` `icon-xs`, `Toggle` `xs`, `RadioIconButton` `icon-xxs`, the
`NumberField` steppers and the `PhoneNumberField` country trigger to 21px, and the xs
`InputGroup.Button` addons to 21px at both densities. Under a 16px root their sizes are unchanged.

`Button` `icon-inline` keeps its visible square as tall as the line and now extends its hit area
to at least a 24px square around it, border included. Before, the border came out of the hit area:
a ghost or outline inline button on a 16px line reached 22px, and less under a 14px root. The
`Combobox` chip remove button keeps its 24px target under a 14px root.
