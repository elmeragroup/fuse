---
"@elmeragroup/fuse": patch
---

An unchecked `Checkbox` or `Radio` draws its edge in `--muted-foreground` instead of `--input`, so the
control stays visible at 3:1 or more against its fill, the page and a card in every theme and color
scheme (WCAG 2.2 SC 1.4.11). Light `--input` measured 1.08–1.70:1, so a group with nothing selected
showed almost no controls beside the labels. This also covers `CheckboxItem`, `RadioItem` and
`CheckboxGroup` rows. Field boxes keep the `--input` border, which the accessibility page now lists
as an accepted deviation until design sets a light field border of at least 3:1.
