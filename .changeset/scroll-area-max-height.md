---
"@elmeragroup/fuse": patch
---

`ScrollArea.Root` now scrolls under a max height. Before, a root with only `max-h-*` let its
viewport grow with the content and clipped the overflow, so the list could not scroll. The
viewport now takes the root's resolved height under either a fixed height or a max height.
