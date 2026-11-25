---
"@elmeragroup/fuse": patch
---

Under a controlled `countryCode` that keeps resolving to the same country, `PhoneNumberField` now
submits the same number whether a `metadata` change comes in a render before the parent stops
controlling `value` or in the same render. Before, releasing the value with the change moved the
number shown before by its international form, so a national `0401 234 567` under a catalog with
no AU trunk prefix submitted `+61401234567` instead of `+610401234567`.
