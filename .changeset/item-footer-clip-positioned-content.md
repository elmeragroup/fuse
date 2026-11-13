---
"@elmeragroup/fuse": patch
---

A hidden `Item.Footer`, and with it a collapsed `SelectionItem.SubSection`, now clips its absolutely
positioned content too. Before, a visually hidden input inside it, such as `DateField`'s, escaped the
clip and lengthened the page or scroll container below the collapsed row. In the `hidden` and
`visible` modes, absolutely positioned footer content now positions against the footer's content
element.
