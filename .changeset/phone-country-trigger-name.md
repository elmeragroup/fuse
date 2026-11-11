---
"@elmeragroup/fuse": patch
---

`PhoneNumberField`'s country trigger is now named by the dial code it shows, then the selected
country, such as "+47 Norway" ("+47 Norge" in Norwegian). A voice-control user can say the "+47"
they see to open the picker (WCAG 2.5.3, label in name). "Select country", and a
`selectCountryLabel` override, now describes the trigger and still names the country popup. Tests
that find the trigger by role and the name "Select country" must look for the new name. A
single-country field now reads its dial code before the country, in the same order.
