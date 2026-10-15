---
"@elmeragroup/fuse": patch
---

`Alert.Title` and `Alert.Description` now follow density through the label text, `--label-text`,
as selection rows do: 14px dense, as before, and 16px comfortable, where they were 14px beside
16px body copy. The title keeps `font-medium` at `leading-snug` and the body regular weight at
`leading-normal`. Beside a description the icon still centres on the title's first line.
`Alert.Root` writes `data-alert`, and `PART_DENSITY` gives the alert's title, description and
described icon media the `label` role.
