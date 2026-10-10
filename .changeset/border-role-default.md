---
"@elmeragroup/fuse": patch
---

Bare borders draw in the `--border` role instead of the text colour, so `DescriptionList`, `Card`, `Table`, `Sheet`, the outline `Badge` and the other parts with an uncoloured border show a quiet divider in every theme. The `Sidebar` rail edge uses `--sidebar-border` and the `NumberField` stepper divider uses `--input`. The default is a base-layer rule on every element, host markup included, and any border colour utility still wins; hosts with their own `border-border` base rule can remove it. A preflight-free Tailwind build that imports Tailwind's sheets into layers declares `@layer theme, base, components, utilities;` before them.
