---
"@elmeragroup/fuse": patch
---

`CheckboxItem` and `RadioItem` now toggle from a click anywhere in the card's label row,
including its side padding. Before, a click in that padding did nothing. A `px-*` utility in
`className` still sets the side padding, and the whole of it stays clickable, so
`<CheckboxItem className="px-6">` toggles from a click 1px inside its border. A
`SelectionItem.SubSection` and the space beside the card stay outside the click target.
Without a preflight `box-sizing: border-box` reset, the card's padding and border no longer
push it past its container.
