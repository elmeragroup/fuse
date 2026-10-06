---
"@elmeragroup/fuse": minor
---

`Accordion.Trigger` takes an `indicator` prop. It defaults to the caret that rotates while the
item is open. Pass `null` to render no indicator, or any node to render it in the caret's place.
Every variant places a custom indicator where it places the caret, including the right edge in
`infodropdown`. Without an indicator the trigger packs its children at the start, so a leading
chevron passed as a child sits beside the label. A custom indicator styles its open state from
the trigger's `data-panel-open` attribute.

`accordionVariants` has a new `indicator` slot that places a custom indicator's wrapper the way
the `icon` slot places the caret.
