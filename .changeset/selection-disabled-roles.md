---
"@elmeragroup/fuse": minor
---

A disabled `RadioItem` or `CheckboxItem` row fills with a new theme role,
`--selection-disabled-background`, under a 45° hatch striped in another,
`--selection-disabled-hatch`. Internal themes keep `var(--muted)` and black stripes at 2% alpha,
so an internal row disabled itself looks as before. External themes keep the card fill of an
enabled row, `var(--card)`, and draw no stripes, so a disabled row is no longer a grey striped
panel among white rows; its control's 50% face and the `not-allowed` cursor mark it. The disabled
fill replaces a checked row's `bg-muted` tint and leaves its border, and it wins over a background
class such as `bg-background` on the row, which used to replace it; set
`--selection-disabled-background` to change it. A row in a disabled `RadioItemGroup` or
`CheckboxItemGroup`, or one whose own control is disabled, now shows the same fill and hatch;
before, only its control dimmed. A host that maps its own tokens onto Fuse roles can set both
roles; without them the row falls back to `--muted` and the 2% black stripes.
