---
"@elmeragroup/fuse": patch
---

Under a controlled `countryCode`, a parent can answer a waiting pick or detected country with the
output it heard, and `PhoneNumberField` now takes that answer as acceptance. This works even when a
format or metadata change comes between the proposal and the answer, and the field shows the same
result either way. A preserved pick keeps its digits as typed, so a picked Finnish number shows
`401234567` rather than `0401234567`. Before, a change in between made the field read the parent's
value again. The field could then show a different display, or read a pasted number in the parent's
country.
