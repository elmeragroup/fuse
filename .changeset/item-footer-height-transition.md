---
"@elmeragroup/fuse": minor
---

`Item.Footer` now animates its height when `mode` switches between `hidden` and `visible`, with
its fade and a short slide, over 150 ms ease-out. `SelectionItem.SubSection`, `RadioItem.SubSection`
and `CheckboxItem.SubSection` are this footer, so a sub-section that opens a form pushes the rows
below it down smoothly instead of in one frame, and closing it pulls them back the same way.
Before, the row snapped both ways, and the slide never ran. Under `prefers-reduced-motion: reduce`
the height still snaps and the fade remains.

A `hidden` or `visible` footer now clips content that reaches more than 4px past its edges, in
both modes, since the row is shorter than its content while it animates. The 4px keeps the shared
focus ring whole. A `default` footer neither animates nor clips.
