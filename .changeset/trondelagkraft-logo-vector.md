---
"@elmeragroup/fuse": patch
---

`TrondelagkraftLogo` (`@elmeragroup/fuse/icons`) draws the full logo from the brand's vector
artwork. Before, it drew a bitmap trace whose edges wobbled and which carried invisible stroke
layers. The viewBox is now `0 0 533.81 88.22` instead of `0 0 539 93`, cropped to the artwork, so at
a fixed height the logo renders about 4% wider. The mark is unchanged.
