---
"@elmeragroup/fuse": patch
---

`Tour.Popup` glides from one step's element to the next instead of jumping. The popup keeps its
place on screen while it moves to the new step, then eases there over 300ms. A second step change
during a glide starts from where the popup is. Scrolling never eases the popup, and a user who asks
for reduced motion sees it move at once.
