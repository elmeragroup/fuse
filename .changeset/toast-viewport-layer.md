---
"@elmeragroup/fuse": patch
---

`Toast.Viewport` now paints above an open `Dialog` or `Sheet`. Before, a toast raised from inside an
open modal shared the modal's `z-50` layer and painted under it, because the modal's portal mounts
later. The viewport now sits on its own `z-60` layer, so a `className="z-60"` override is no longer
needed.
