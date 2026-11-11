---
"@elmeragroup/fuse": minor
---

`DescriptionList.Content` takes `dividers={false}` to drop the rules a responsive list draws between
its Items, chosen once for the whole list instead of a `border-t-0` class on every Item. It reaches
only that list's own Items, so a list nested inside keeps its own rules. The default `true` leaves
existing lists unchanged. An inline list draws no rules either way, so `dividers` has no effect
there. A list with `dividers={false}` writes `data-dividers="false"`.
