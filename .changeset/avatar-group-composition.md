---
"@elmeragroup/fuse": minor
---

`Avatar` ships `Avatar.Group`, which stacks its avatars and separates them with a background-coloured
ring. A stack no longer needs `flex -space-x-2` on a wrapper plus `ring-2 ring-background` on every
avatar: render `Avatar.Root` children inside `Avatar.Group`.

The group's ring rule wraps the whole parent-and-child selector in `:where()`, so it scores zero
specificity and your explicit ring utility on a child avatar (`ring-0`, `ring-1`, `ring-foreground`, …)
still wins.
