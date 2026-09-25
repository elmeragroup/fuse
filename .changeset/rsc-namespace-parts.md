---
"@elmeragroup/fuse": patch
---

Server components can read compound namespaces such as `Dialog.Root`. The namespace object is no longer a client-module reference, so dotting into a part does not throw. Alert stays server-rendered: the Item chrome it composes has no hooks.
