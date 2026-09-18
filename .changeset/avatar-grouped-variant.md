---
"@elmeragroup/ui": minor
---

`Avatar.Root` now takes `grouped`, which separates stacked avatars with a background-coloured ring so a
stack no longer needs `ring-2 ring-background` on each avatar. Your `className` is merged last, so a
conflicting ring or size still wins.
