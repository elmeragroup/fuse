---
"@elmeragroup/fuse": patch
---

`PhoneNumberField` keeps a number typed or autofilled before React hydrates. The field used to start from its own initial value and wrote it over the typed text in the first render after hydration, so the number vanished and the hidden input never held it. It now reads the typed number once, as hydration commits, and proposes it as an edit, so `onChange` reports it once and a controlled parent can accept it.
