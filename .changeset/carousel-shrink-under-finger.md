---
"@elmeragroup/fuse": patch
---

A `Carousel` whose page count shrinks while a finger holds it no longer jumps away from the
finger. When a page was pressed before the carousel could measure itself, and the finger then
swiped back before slides were removed or the viewport widened, the carousel jumped to the last
remaining page under the finger and never reported the page the swipe ended on. It now stays
where the finger left it and reports that page once the swipe ends, to a controlled parent too.
