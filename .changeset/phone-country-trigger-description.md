---
"@elmeragroup/fuse": patch
---

`PhoneNumberField`'s country trigger now has an accessible description naming the selected
country and its dial code ("Country: Norway +47", in all four locales), so a screen-reader user
knows which country code the number goes with without opening the picker. A read-only field's
trigger no longer carries `aria-readonly`, which the button role does not support.
