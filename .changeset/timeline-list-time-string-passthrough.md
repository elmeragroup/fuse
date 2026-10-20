---
"@elmeragroup/fuse": patch
---

`TimelineList.Time` now writes a valid `date` string to `dateTime` unchanged instead of converting
it through the rendering machine's time zone, so a server and a browser in different zones render
the same value and a date-only string stays a calendar date. Only a `Date` is normalized with
`toISOString()`. Development builds warn about a date-time string without an offset.
