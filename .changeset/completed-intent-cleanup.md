---
"@elmeragroup/ui": patch
---

`Button` stops measuring a button and drops the shared `pointermove` listener as soon as its `onIntent` callback has fired, instead of at unmount.
