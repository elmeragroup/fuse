---
"@elmeragroup/fuse": patch
---

`Alert.Description` now takes the variant's text colour from `Alert.Root`, as the title does. It
forced `foreground`, so on the info, warning and destructive alerts the body sat in a different
colour from its title. The body is now `info-soft-foreground` on info, `warning-soft-foreground`
on warning and `error` on destructive; default and success keep `foreground`. A colour class on
`Alert.Description` still wins.
