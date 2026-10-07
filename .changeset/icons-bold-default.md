---
"@elmeragroup/fuse": minor
---

Curated Phosphor icons from `@elmeragroup/fuse/icons` now default to the `bold` weight, so they
match the stroke weight products drew with before. Phosphor's `regular` weight draws a thinner
stroke at every size. `ElmeraIconProps["weight"]` and `Alert.Icon`'s `weight` accept `"bold"`
alongside `"regular"` and `"fill"`. Pass `weight="regular"` to keep the previous look.

`DoubleCheck` is removed. Import `Checks` instead: the Phosphor glyph draws the same double tick
and follows the `weight` prop.

`Sun`, `Moon` and `Monitor` join the curated roster for light, dark and system color-scheme
controls.
