---
"@elmeragroup/fuse": minor
---

`Sidebar.Provider` takes `openMobile` and `onOpenMobileChange`, so a host can hold the phone Sheet's
open state and close it from outside, such as after a navigation. The Trigger, ⌘B, the Sheet's own
dismissal, `useSidebar().setOpenMobile` and `toggleSidebar` report a request through
`onOpenMobileChange` and leave the Sheet as the host's `openMobile` says. Like the desktop `open`,
the setter still takes a boolean or an updater. Without the props the Sheet keeps its state inside,
as before. Before, the phone Sheet's state was private to the Provider.
