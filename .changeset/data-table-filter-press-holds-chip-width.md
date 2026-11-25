---
"@elmeragroup/fuse": patch
---

A press on a `DataTableFilter` chip now lands on the segment it started on when applying an open
editor's change resizes another chip that stays in the strip. The change applies as the press
moves focus, before its click. Before, a chip that grew or shrank could move the pressed segment
out from under the pointer, so an Operator's list opened and closed again, a Value opened no
popover, or a Remove left its chip. The strip now holds the resized chip's width until the click,
for a mouse press and a tap.
