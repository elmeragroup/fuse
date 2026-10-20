---
"@elmeragroup/fuse": patch
---

`TimelineList.Time` now writes an HTML date or date-time `date` string to `dateTime` unchanged
instead of converting it through the rendering machine's time zone, so a server and a browser in
different zones render the same value and a date-only string stays a calendar date. A `Date`, or
another string the JavaScript date parser reads, such as `June 15, 2024` or `2024-02-30`, is still
normalized with `toISOString()`. Development builds warn about a date-time string without an offset.
