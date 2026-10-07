---
"@elmeragroup/fuse": minor
---

`PhoneNumberField` takes a `defaultValue`, so an uncontrolled field can start from a saved number without a controlled parent. It is read on mount the way `value` is, and a native form reset restores it, read again under the current props: a field that turned on `formatOnType` in between shows the default formatted. A reset that returns to a default in another country calls `onCountryChange`; `onChange` stays silent, as before. `defaultValue=""` restores an empty number in the default country. A later `defaultValue` change leaves the shown number alone and becomes the next reset's target, and a controlled `value`, even `""`, wins over it. Without a default, reset still clears the digits and keeps the country.
