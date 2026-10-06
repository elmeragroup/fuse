---
"@elmeragroup/fuse": patch
---

`TelinetLogo variant="mark"` and `BrandLogo brand="fkse" variant="mark"` (`@elmeragroup/fuse/icons`)
now crop to the dot cloud. Before, the mark kept the full wordmark's 655×93 viewBox, so the dots
painted about 3px wide and 2px tall in a 24px box. The viewBox is now 83.397×64.796 and the artwork
fills the box width.
