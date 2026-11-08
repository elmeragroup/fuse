---
"@elmeragroup/fuse": minor
---

`Sidebar.Inset` takes a `render` prop. It still renders a `<main>` by default; a layout that
already has its own `<main>` passes `render={<div />}` and keeps the inset's slot and look,
including the inset card beside an `inset` Sidebar. Before, it always rendered a `<main>`.
