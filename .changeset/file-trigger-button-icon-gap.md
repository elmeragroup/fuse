---
"@elmeragroup/fuse": patch
---

`FileTrigger` spaces and pads its leading icon as a Button with a `data-icon="inline-start"` icon
does, at both densities. Before, it set a fixed 8px gap between the icon and the label and padded
the icon side as wide as the label side, so it differed from a leading-icon Button beside it, such
as in a `ButtonGroup`. The gap now follows the density, and the icon side's padding narrows to
Button's icon-side padding. With `withIcon={false}` nothing changes. A `className` passed to
`FileTrigger` still reaches the button.
