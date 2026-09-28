---
"@elmeragroup/fuse": patch
---

An explicit `aria-label` on an icon-only `Toast.Close` now names the button. Before, the icon-only
close button kept its `label` or the dictionary `toast.close` name and ignored `aria-label`.

An explicit `aria-label` on `BrandLogo` (`@elmeragroup/fuse/icons`) now names the logo. Before,
`title` or the brand display name replaced it.
