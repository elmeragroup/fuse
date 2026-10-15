---
"@elmeragroup/fuse": minor
---

`Alert.Root` and `Alert.Icon` take `variant="info"`: an informational alert on the `info-soft`
fill with an `info` border, the `Info` glyph in `info`, and an action button on the `info` fill.
Its focus ring takes `info-soft-foreground`, as the warning alert's does, so it holds 3:1 on the
fill in the dark scheme.

`Badge` takes `variant="soft-destructive"`, `variant="soft-success"` and `variant="soft-warning"`,
so every status has a soft arm beside `soft-info`: the soft status fill, its soft foreground
and a 20% status border. `soft-destructive` keeps the `destructive` name, like
`outline-destructive`, and draws the `error` roles. `Badge` also takes `variant="outline-info"`,
`info` border and text like `outline-success` and `outline-warning`, so every status has a
filled, an outline and a soft arm.

Migration: `Badge`'s soft blue arm is renamed from `variant="info"` to `variant="soft-info"`,
beside `soft-success` and `soft-warning`. `variant="info"` now draws a filled badge on `info`
with `info-foreground` text, like `success` and `warning`. Replace `variant="info"` with
`variant="soft-info"` to keep the soft look; the type checker does not flag it, because `info`
is still a valid value.
