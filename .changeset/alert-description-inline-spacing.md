---
"@elmeragroup/fuse": patch
---

`Alert.Description` no longer adds 8px above an inline-block child, such as a button, badge or
`kbd`, that follows another element. Before, a `Popover.Trigger` inside the description made the
alert grow 8px when the popover opened, and an inline button after a `strong` or link raised its
line. The 8px gap now applies only to block children such as paragraphs, lists, headings,
`details` and tables that follow another child, and to an image or other media right after one of
those blocks. The gap weighs as much as one element selector: a margin reset such as
`* { margin: 0 }` leaves it in place, and any consumer class rule overrides it, such as
`className="[&>*+*]:mt-0"` on the description or `.my-description > p { margin-top: 0 }`.
