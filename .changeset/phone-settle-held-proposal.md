---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` calls `onCountryChange` a second time when it returns to a pasted number's
country. This covers a paste the field already showed in that country, under a set `value` and a
`countryCode` of another country. After a render that shows the `countryCode` country, the next render that shows the
pasted number's country calls `onCountryChange` with it again.
