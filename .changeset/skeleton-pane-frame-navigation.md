---
"@elmeragroup/fuse": patch
---

A `SkeletonReveal` rendered into a same-origin iframe now unmounts without an error after the
iframe loads a new document. Before, the unmount threw a `SecurityError` when the new document was
from another origin, and the skeleton's resize and mutation observers and its `load` listener stayed
connected. When the unmount came while the reveal eased its height, it threw after any new document,
before it canceled the height ease and the pane fades. When the new document was same-origin, the
unmount could also cancel one of that document's animation frames. A skeleton rendered into the
iframe's initial `about:blank` now stops its once-a-second font check at unmount after the iframe
loads a same-origin document. Before, when a script stopped the iframe's `visibilitychange` event,
the check kept running and kept the old document in memory.
