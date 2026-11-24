---
"@elmeragroup/fuse": patch
---

From Chrome 111 to 119, on a page without a `dir` attribute, the `NavigationMenu` caret now turns
toward a submenu that opens to the inline start or end, and the `Sidebar.Rail` toggle strip is
centered on the sidebar edge again. Both used Tailwind's `ltr:` variant, which matches nothing
there because it needs `:dir()` from Chrome 120 or a `dir="ltr"` attribute.
