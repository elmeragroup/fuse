---
"@elmeragroup/fuse": minor
---

`Input` and `InputGroup.Input` take `filter="numeric"`, the digits-only guard `TextField` already had. Non-digits are stripped before `onChange` and Field validation read the value, `maxLength` counts digits, so a pasted `912 34 567` fits `maxLength={8}` whole, and `inputMode` defaults to `numeric`. A digits-only field can now carry an `InputGroup` prefix or suffix, such as `+47` before a phone number. `TextField` forwards its `filter` to `Input` and behaves as before, except that its development warning for a non-digit `value` or `defaultValue` now reads `Input: … is not a number`.
