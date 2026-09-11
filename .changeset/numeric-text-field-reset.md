---
"@elmeragroup/ui": patch
---

`TextField` with `filter="numeric"` now restores its `defaultValue` on native form reset instead of keeping the edited digits. `onChange` is not called for the reset.

Non-digits are now stripped from every input path instead of being refused on browsers that emit a cancellable `beforeinput`. A mixed paste such as `12a3` produces `123` everywhere instead of inserting nothing in Chromium and WebKit.
