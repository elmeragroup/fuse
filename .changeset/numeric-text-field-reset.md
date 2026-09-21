---
"@elmeragroup/fuse": patch
---

`TextField` with `filter="numeric"` now restores its `defaultValue` on native form reset instead of keeping the edited digits. `onChange` is not called for the reset.

Mixed input such as a pasted `12a3` is now stripped to `123` instead of the whole edit being rejected.
