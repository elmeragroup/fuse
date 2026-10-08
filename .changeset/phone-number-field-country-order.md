---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` lists the country picker's rows in the alphabetical order of their names in the active locale, so "Nederland" precedes "Norge" in Norwegian and "Åland" follows "Sydafrika" in Swedish. The rows sort as the picker opens, so a field resolves no country name before its first open, the selected country stays highlighted, and a locale change reorders the rows at the next open rather than under the highlight.
