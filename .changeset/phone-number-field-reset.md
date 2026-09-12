---
"@elmeragroup/ui": patch
---

Native form reset now clears an uncontrolled `PhoneNumberField` number while keeping the selected country. `onChange` and `onCountryChange` are not called; a controlled `value` stays parent-owned.
