---
"@elmeragroup/fuse": minor
---

`CheckboxGroup`, `CheckboxItemGroup`, `RadioGroup` and `RadioItemGroup` take `isLabelHidden`. The
legend stays the group's accessible name but is visually hidden, and the first option moves up into
its place. Use it when a section heading above the group already names it. A pending radio group
keeps its spinner row visible. A `description` still renders.
