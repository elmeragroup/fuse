---
"@elmeragroup/fuse": minor
---

`PhoneNumberField` takes a controlled `countryCode`, paired with `onCountryChange`, so a parent can
steer the country, including that of an empty field. A new `countryCode` acts like a picker pick: it
clears the digits unless `preserveOnCountryChange` keeps them, and proposes the cleared number
through `onChange`. A controlled `value` that names its country with `+` or `00` keeps it: with
`"+46…"` and `countryCode="NO"` the field shows Sweden and `onCountryChange` proposes it. A pick or
detected country the parent does not accept returns the field to the parent's country, and an
uncontrolled number reports a pick's number through `onChange` only once the field shows it.
`onCountryChange` is never called for the code the parent just set, and only once per disagreement.
