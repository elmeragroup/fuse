---
"@elmeragroup/ui": patch
---

Add the package-private react-aria support stack (internal button/field/checkbox/dialog/modal/popover, overlay-container seam) and the three runtime dependencies it installs — `react-aria`, `react-aria-components` and `@internationalized/date` — no public API surface; the `react-aria/*` entries ship with the date cluster. The other two react-aria-adjacent runtime dependencies arrived earlier: `tailwindcss-react-aria-components` with the token pipeline, `@internationalized/string` with the localized string dictionaries.
