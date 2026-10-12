---
"@elmeragroup/fuse": minor
---

A disabled `RadioItem` or `CheckboxItem` row fills with a new theme role,
`--selection-disabled-background`, under a 45° hatch striped in another,
`--selection-disabled-hatch`. Internal themes keep `var(--muted)` and black stripes at 2% alpha.
External themes keep the card fill of an enabled row, `var(--card)`, and draw no stripes, so a
disabled row is no longer a grey striped panel among white rows. In every theme the row's title,
description and actions now dim to 50% beside the control's own 50%, as a plain `Radio` row's
label does, while a `SubSection` keeps its colours. The disabled fill replaces a checked row's
`bg-muted` tint and leaves its border. A row in a disabled `RadioItemGroup` or
`CheckboxItemGroup` now shows the same disabled look; before, only its control dimmed. A host that
maps its own tokens onto Fuse roles can set both roles; without them the row falls back to
`--muted` and the 2% black stripes.
