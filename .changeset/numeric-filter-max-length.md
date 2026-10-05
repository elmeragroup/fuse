---
"@elmeragroup/fuse": patch
---

`TextField` with `filter="numeric"` counts `maxLength` in digits. Before, the browser cut a pasted
value to `maxLength` characters before the filter stripped the separators, so `912 34 567` pasted
into a `maxLength={8}` field became `912345`. Now the digits that fit land at the caret. This
covers insertions the filter can intercept, a cancelable `beforeinput` on an input with a selection
such as `text` or `tel`; `type="email"` or `"number"`, and autofill that sends no cancelable
`beforeinput`, are still cut to `maxLength` first.
