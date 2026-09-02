---
"@elmeragroup/ui": patch
---

The shared overlay close button no longer carries a `"use client"` directive: it owns no state and is only ever rendered from the already-client Dialog and Sheet modules.
