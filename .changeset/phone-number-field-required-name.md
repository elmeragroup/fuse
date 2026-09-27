---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` now forwards `required` to its input so an empty required field cannot submit, and an unnamed field no longer adds a `phone-number-display-value` entry to form data.
