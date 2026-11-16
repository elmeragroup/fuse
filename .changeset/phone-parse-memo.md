---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` shows the country a controlled `value` names after the parent echoes a pasted
number, also when a tab or newline cut the previous value short. Before, a previous value of
`"+46\n701234567"` under `countryCode="NO"` kept Norway after the parent echoed a pasted
`"+46701234567"`, though the echoed value names Sweden.
