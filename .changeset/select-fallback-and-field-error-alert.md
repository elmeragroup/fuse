---
"@elmeragroup/fuse": patch
---

The `alignItemWithTrigger` docs on `Select.Content` now name a Base UI 1.8 limitation. An
item-aligned popup is placed in viewport coordinates, so inside a portal target that is, or sits
inside, the containing block for `position: fixed` content, such as a transformed or
`contain: paint` scope, the list opens away from its trigger. Pass `alignItemWithTrigger={false}`
there.
