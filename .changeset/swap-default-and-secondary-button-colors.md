---
"@elmeragroup/fuse": minor
---

`Button`'s `default` and `secondary` variants swap their fills.

`default` now paints `--secondary` with `--secondary-foreground`, hovers to `--secondary-hover`, and keeps
its resting fill while `aria-expanded`, as `secondary` did. `secondary` now paints `--primary` with
`--primary-foreground` and hovers to `--primary/80`. No token value, no other variant and no API changed, so
a call site that names neither variant moves from the `--primary` fill to the `--secondary` one.

Inside Fuse this moves `AlertDialog`'s confirm button and a `FileTrigger` given no `variant`. `Alert`'s
action button already replaces the fill with `--background`, and `Pagination` and the `DatePicker` presets
take `outline` or `ghost`, so none of those move. A call site that wants the old default look passes
`variant="secondary"`, and one that wants the old secondary look passes `variant="default"`.
