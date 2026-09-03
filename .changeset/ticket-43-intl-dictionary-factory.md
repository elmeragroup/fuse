---
"@elmeragroup/ui": minor
---

Consolidate the localized-string internals. Every component's `intl/index.ts` now assembles its dictionary through the shared package-private `createStringDictionary({ enUS, fiFI, nbNO, svSE })` factory instead of repeating the same `LocalizedStringDictionary` literal, so a missing locale is a type error at the call site. Dialog, Sheet, Toast, and the package-private react-aria picker dialog resolve one family-owned `overlay.close` row in `components/overlay/intl` in place of three identical per-component rows.

No public API change, no change to any rendered string in any of the four locales, and no change to formatter-cache behaviour: the same dictionary and locale still yield the same formatter instance.
