---
"@elmeragroup/fuse": patch
---

When React reveals an uncontrolled `PhoneNumberField` inside an `<Activity>`, the field no longer
sends `onChange` a number it stopped submitting while hidden. Before, a props change made while the
field was hidden, such as a new `countryCode`, kept its output for `onChange`, and a later
`outputFormat` change did not replace it. An uncontrolled field now sends the number it submits at
the reveal, and nothing when that number is the output from before the proposal. A controlled field
still sends the number the change proposed. A later change that would call `onChange` replaces the
queued call, so `countryCode` moved from `NO` to `SE` to `DK` while hidden, with
`outputFormat="e164"` and `preserveOnCountryChange`, sends only `+4541234567` for `41234567`. A new
`value` while the field is hidden cancels a call queued before it, so the parent no longer hears the
old number on reveal.
