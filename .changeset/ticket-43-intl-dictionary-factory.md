---
"@elmeragroup/ui": patch
---

Assemble every localized-string dictionary through the shared `createStringDictionary` factory, and give Dialog, Sheet, and Toast one shared overlay `close` row instead of three identical per-component rows. No public API change and no change to any rendered string in any of the four locales.
