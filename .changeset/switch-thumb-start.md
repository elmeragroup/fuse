---
"@elmeragroup/fuse": patch
---

`Switch` keeps its thumb inside the track when a parent's zero-weight rule centres its children's
content, such as `[:where(&>*)]:justify-center`. The track now sets `justify-start` itself, so the
checked thumb no longer runs past the track's end.
