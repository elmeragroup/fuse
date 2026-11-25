---
"@elmeragroup/fuse": patch
---

Tabbing into a scrollable `ScrollArea.Root` now shows a 2px focus outline just inside the area's
edge, including in forced-colors mode. The old ring drew outside the viewport, and in an area
without padding the root's `overflow: hidden` clipped it away. The outline now also draws above
sticky and other positioned content in the area.
