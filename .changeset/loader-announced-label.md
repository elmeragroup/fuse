---
"@elmeragroup/fuse": minor
---

`Loader` now announces itself. It renders visually hidden text inside its `role="status"` region:
the new `label` prop, then its `aria-label`, then the locale dictionary's "Loading" (nb-NO, sv-SE,
en-US and fi-FI). Before, the region held only a decorative icon, so screen readers announced
nothing. Loader stays a server component; without a `label` or `aria-label` it now needs the
`LocaleProvider` that Fuse's other localized components already read.
