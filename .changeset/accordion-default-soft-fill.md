---
"@elmeragroup/fuse": patch
---

A default `Accordion.Item` now fills with the brand's soft tint, `primary-soft`, instead of the grey
`muted`. The item's text, including the panel body, the trigger label and the caret, takes
`primary-soft-foreground`. Focus rings inside the item take the same colour, so they hold 3:1 on the
tint. The internal themes look almost the same. The external themes swap the grey box for the brand
tint. Without preflight, the trigger no longer paints the native button's text and background colours.
To keep the grey look, pass `className="bg-muted text-foreground"` on `Accordion.Item`.
