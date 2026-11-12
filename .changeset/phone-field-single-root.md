---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` now renders as one element, as `TextField` does. Its hidden form input used to
follow the field as a sibling, so in a `space-y-*`, `divide-y` or `last:` container the phone field
got a trailing margin or border that `TextField` did not. The input now sits inside the field, and
form submission is unchanged.
