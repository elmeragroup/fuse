---
"@elmeragroup/fuse": patch
---

Server components can read compound namespaces such as `Dialog.Root`. The namespace object is no longer a client-module reference, so dotting into a part does not throw. Alert stays server-rendered: the Item chrome it composes has no hooks. Item's markup parts (`Media`, `Content`, `Title`, `Description`, `Actions`, `Header`, `Footer`) and SelectionItem's `Description` and `Content` are server components. A function-form `render` on `Item.Root` now receives an empty state object; the root's `data-slot`, `data-variant` and `data-size` arrive as ordinary props instead.
