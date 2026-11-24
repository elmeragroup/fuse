---
"@elmeragroup/fuse": patch
---

`SkeletonReveal` no longer checks the document's fonts on every animation frame. Its bones redraw
when a font it already saw finishes loading, even while another font is still loading. On a visible
page it also checks once a second, which finds a font that a script added after loading it, or
while another font was loading.
