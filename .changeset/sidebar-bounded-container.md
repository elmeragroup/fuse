---
"@elmeragroup/fuse": minor
---

`Sidebar.Provider` takes a `bounds` prop, so a Sidebar can live in a box on the page, such as an
embedded app pane or a demo. The default, `bounds="page"`, keeps today's behaviour. With
`bounds="container"` the Provider fills its container's height instead of at least the
viewport's, and the desktop rail sits in the container, as tall as it, instead of fixed to the
viewport. The container clips the collapsed offcanvas rail at its edge. The Provider writes no
`sidebar:state` cookie, so pass `open` and `onOpenChange` to keep the state yourself. ⌘B, or
Ctrl+B, toggles it only from a keydown inside the Provider, and a page Sidebar around it keeps
the shortcut everywhere else. The mobile Sheet still switches on the viewport's width. The new
`SidebarBounds` type names the prop's values.

Before, a Sidebar in a box needed `transform` or `contain: paint` on the box to hold the fixed
rail, `h-full` on `Sidebar.Root`, and a capture-phase listener to stop ⌘B from toggling it
anywhere on the page, and it wrote the page's cookie even when controlled.
