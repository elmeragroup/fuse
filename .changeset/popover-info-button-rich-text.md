---
"@elmeragroup/fuse": patch
---

`PopoverInfoButton` now wraps its children in one body element, so inline content, such as a
sentence with a `<strong>` or a link, renders as one paragraph in the popup. Before, every text run
and inline element became its own row, 16px from the next. Consecutive block children, such as two
`<p>`s, are now spaced by the small surface gap, `--surface-gap-sm` (8px dense, 12px comfortable),
instead of the popup's 16px, and their user-agent margins are zeroed. Inline-block children, such as
a button, stay on their line. A `<p>` wrapper at the call site is no longer needed.
