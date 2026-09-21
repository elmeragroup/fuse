---
"@elmeragroup/fuse": minor
---

`Collapsible.Content` now ships the open/close height transition (150 ms ease-out, keyed on Base UI's
starting/ending styles) shared with `Accordion`, which previously never animated. Your `className` is
merged last, so a conflicting utility wins; a full opt-out is
`h-auto data-starting-style:h-auto data-ending-style:h-auto overflow-visible transition-none`.

The panel keeps `overflow-hidden` in every state, including while open, so content that escapes the
settled panel box — an absolutely positioned child, a popover, a focus ring past the edge — is
clipped. The opt-out above releases the clipping along with the animation.
