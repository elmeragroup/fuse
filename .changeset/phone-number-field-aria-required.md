---
"@elmeragroup/fuse": minor
---

`PhoneNumberField` accepts `aria-required` and forwards it to the visible number input only. A phone number that a schema requires only in some cases can now be announced as required without the native `required` constraint. Before, the prop was not in the type and never reached the input.
