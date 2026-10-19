---
"@elmeragroup/fuse": patch
---

A `Card.Content` or `Card.Footer` that opens a card now pads its top with the card's tier. Before,
it dropped its top padding even with nothing above it, which put its content against the card's top
edge. Host rules that restored that padding can go. A content or footer below another section still
drops its top padding, so the tier stays the gap between sections. On such a section, a `pt-*`,
`py-*` or `p-*` class that sets a top padding now needs `not-first:pt-*` beside it to win at the top.
