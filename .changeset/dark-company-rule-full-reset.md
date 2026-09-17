---
"@elmeragroup/ui": patch
---

`themes.css`: the external dark company rule (`fkas` + `company`) now materializes the complete
dark reset set like every other dark rule, so the cascade resolves the equal-specificity tie
between the light company selector and the dark brand selector by specificity rather than by rule
emission order. No token values changed — the added declarations repeat values the adjacent dark
brand rule already supplies. The emitted sheet grows by about 2.9 KB raw / 29 bytes gzip, which
changes the bytes consumers cache.
