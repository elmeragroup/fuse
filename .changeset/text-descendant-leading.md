---
"@elmeragroup/fuse": patch
---

Links, `<strong>`, child paragraphs and other descendants of `Text` and `Span` now take the
component's `leading`. In `<Text leading="snug">`, a nested link has 22px lines like the text around
it. Before, each descendant fell back to its size's own line height, 24px at the default size, so a
line containing a link or `<strong>` could grow taller than its neighbours, and child paragraphs of
`<Text elementType="div">` ignored the Text's `leading`. Descendants are still set in the Text's
font size, and a descendant's own `leading-*` class still wins.
