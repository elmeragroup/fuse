---
"@elmeragroup/fuse": patch
---

`@elmeragroup/fuse/chart.css` now carries the `-webkit-` prefixes the browser floor needs. Below
Chrome 120 the crosshair keeps its faded ends, series past the active point dim, and the pie,
radial, clock and gauge skeletons keep their holes. The sheet now asks Chrome 111 to 135 to keep
chart colors when printing. The shipped sheet no longer carries the source's comments.
