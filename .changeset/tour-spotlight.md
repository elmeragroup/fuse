---
"@elmeragroup/fuse": minor
---

Adds `Tour.Spotlight` to `@elmeragroup/fuse/tour`. Placed inside `Tour.Popup`, it dims the page
around the step's element with the overlay scrim's tint and leaves the element lit. The dim takes
every press outside the popup, the lit element included, and such a press ends the run without
writing a status. Pair it with `modal="trap-focus"` on `Tour.Popup` and a `Tour.Close`, which keep
focus in the popup while the rest of the page is hidden from assistive technology. A development
build warns when the popup has no `Tour.Close`.
