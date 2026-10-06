---
"@elmeragroup/fuse": minor
---

A manager from `Toast.createToastManager()` queues calls made before its `Toast.Provider` connects and
replays them in call order once it does. Before, a toast raised before the provider mounted, or in a
mount effect inside it, never showed. `add` still returns the toast id at once, so a queued toast can
be updated or closed.
