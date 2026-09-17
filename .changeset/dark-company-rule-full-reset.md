---
"@elmeragroup/ui": patch
---

`themes.css`: the external dark company rule (`fkas` + `company`) now materializes the complete
dark reset set like every other dark rule, and every segment that departs from its brand base in
either scheme gets its dark rule, so the four-attribute dark segment selector always outranks the
three-attribute light segment selector and the cascade never falls back to emission order. No token
values changed — the added declarations repeat values the adjacent dark brand rule already
supplies. The emitted sheet grows by about 2.9 KB raw / 29 bytes gzip, which changes the bytes
consumers cache.
