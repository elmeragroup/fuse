---
"@elmeragroup/fuse": patch
---

The `ScrollArea.Bar` thumb now shows in forced-colors mode, in the `CanvasText` system color. Before,
the browser painted it in the canvas color, so a `ScrollArea` or an `Attachment.Group` showed no
scroll position.
