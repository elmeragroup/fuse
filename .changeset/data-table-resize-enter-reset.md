---
"@elmeragroup/fuse": patch
---

`DataTable.ResizeHandle`: Enter resets the column to its default width, as a double-click does.
Before, no key reset it, so a keyboard user could not always return to the default width.
Enter, Left Arrow, Right Arrow, Home and End on the handle no longer reach enclosing React
`onKeyDown` handlers, such as a form's or a header's. A chord with Alt, Control or Meta, or a key
that an input method is composing, still reaches them and leaves the width alone. During a pointer
drag these keys do nothing, so the release commits the dragged width.
