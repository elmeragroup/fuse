---
"@elmeragroup/fuse": patch
---

A `Carousel` inside an ancestor whose transform animates, such as an opening popup, now waits, for
up to about half a second, for a reading of its slides at one consistent scale before it places its
page or reads where a scroll ended, so it lands on and reports the right page. Before, WebKit could
read the viewport and the slides at different points of the animation, and the carousel then
stopped on the wrong page.
