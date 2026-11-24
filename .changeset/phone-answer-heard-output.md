---
"@elmeragroup/fuse": patch
---

Under a controlled `countryCode`, `PhoneNumberField` now judges a parent's answer to a waiting pick
or paste against the output the parent heard, never against an output that a later format,
metadata or catalog change gave the proposal. The same final props give the same display, output
and notices whether such a change came before the answer or with it. Before, a parent's old value
could match a carried output by chance: a format change alone then answered the number, or a held
output was read again as a new value, so a picked Finnish number showed `0401234567` instead of
`401234567`.
