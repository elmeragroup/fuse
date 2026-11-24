---
"@elmeragroup/fuse": patch
---

While a country the user picked, pasted or typed waits for the parent and the picker still offers
it, a new `countryCode` that accepts it or moves the field to another country now makes an
uncontrolled `PhoneNumberField` compare its output with the output from before that proposal.
Before, an `outputFormat` change during the wait moved the output it compared with. For the number
`41234567` under `countryCode="NO"` with `preserveOnCountryChange`, picking Sweden, switching from
`"e164"` to `"raw"` and then setting `countryCode="SE"` never called `onChange("41234567")`.
