---
"@elmeragroup/fuse": patch
---

Bare borders draw in the `--border` role instead of the text colour, so `DescriptionList`, `Table`, `Sheet`, the outline `Badge` and the other parts with an uncoloured border show a quiet divider in every theme. The `Sidebar` rail edge uses `--sidebar-border`, the `NumberField` stepper divider uses `--input`, and `Card` and the `card` Accordion item use `--card-border`, which external themes make transparent. The default is a base-layer rule on every element, host markup included, except native form widgets outside Fuse parts, which keep their own border colour and native look. Any border colour utility still wins; hosts with their own `border-border` base rule can remove it unless it colours those widgets. A preflight-free Tailwind build that imports Tailwind's sheets into layers declares `@layer theme, base, components, utilities;` before them.
