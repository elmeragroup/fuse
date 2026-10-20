---
"@elmeragroup/fuse": patch
---

`PhoneNumberField`'s `metadata` JSDoc now says that custom or trimmed metadata does not shrink the
bundle, since the field imports its full default metadata either way.
