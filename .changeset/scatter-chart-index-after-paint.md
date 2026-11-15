---
"@elmeragroup/fuse": patch
---

`ScatterChart` builds its nearest-point index right after the paint that draws new data, so the
first pointer move over a large chart no longer pays for the build. Before, the first move after
each data update built it, about 7 ms at 100,000 points.
