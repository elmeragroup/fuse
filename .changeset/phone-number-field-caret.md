---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` keeps the caret among the digits when an edit makes it rewrite the display, as `formatOnType` does on most keys. Correcting a digit in the middle of a number, deleting a space the formatter puts back, or deleting forward no longer sends the rest of the typing to the end, and an international display keeps the caret after the calling code it adds. The caret stays put when the parent's answer shows the display the edit proposed, even if the parent stores the number in another form; otherwise, including a proposal echoed only in a later render, the field leaves the caret where the browser puts it.
