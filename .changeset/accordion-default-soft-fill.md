---
"@elmeragroup/fuse": patch
---

A default `Accordion.Item` now fills with the brand's soft tint, `primary-soft`, instead of the grey
`muted`. Its label and caret take `primary-soft-foreground`, and its focus ring takes the same colour
so it holds 3:1 on the tint. The internal themes look almost the same. The external themes swap the
grey box for the brand tint. The trigger label also takes its item's text colour now instead of the
native button colour. To keep the grey, pass `className="bg-muted"` on `Accordion.Item`.
