---
"@elmeragroup/fuse": patch
---

A form whose `onReset` handler stops propagation no longer blocks native reset for an uncontrolled `NumberField`, `PhoneNumberField`, or `TextareaField`. An uncontrolled `NumberField` focused inside a shadow root also keeps focus through the reset remount, and a suspended update no longer disables reset for a field that is still displayed as uncontrolled.
