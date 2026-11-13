---
"@elmeragroup/fuse": patch
---

`Item.Footer` in its `hidden` and `visible` modes, and with it `SelectionItem.SubSection`, now clips
absolutely positioned content that has no positioned ancestor inside the footer. Before, such content
escaped the clip: a visually hidden input in a collapsed footer, such as `DateField`'s, lengthened the
page or scroll container below the collapsed row. In those two modes, that content now positions
against the footer's content element instead of an ancestor outside the footer, so an inset child
such as `absolute top-0 right-0` moves to the content element's corner.
