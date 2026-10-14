---
"@elmeragroup/fuse": patch
---

`Form`'s JSDoc now says that it does not focus the interim react-aria fields for a returned
error, beside the two existing caveats: their values are not in `onFormSubmit`'s, and their own
validation does not block a submit.
