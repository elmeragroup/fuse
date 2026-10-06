---
"@elmeragroup/fuse": minor
---

Add Nordic Green Energy as brand `ngfi`, for the private and company segments in both variants.
The external palette maps the Nordic Green Energy Material 3 scheme in light and dark, and the
`brand-ngfi` and `brand-ngfi-foreground` primitives back the internal brand pointer and the
`bg-brand-ngfi` utility. `NordicGreenEnergyLogo` joins `@elmeragroup/fuse/icons`, and
`BrandLogo` draws it for `ngfi`.

The new code widens `BrandCode`, `ThemeInput` and `ThemeSlug`, and `LEGAL_THEMES` grows from 20
to 24 themes. An exhaustive `switch` or `Record` over `BrandCode` needs an `ngfi` case.
