---
"@elmeragroup/fuse": patch
---

`PhoneNumberField`'s country trigger now tells a screen-reader user which country the number goes
with, without opening the picker. A read-only field's trigger no longer carries `aria-readonly`,
which the button role does not support.
