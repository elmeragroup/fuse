---
"@elmeragroup/fuse": patch
---

`Sidebar.Provider`'s keyboard shortcut now uses the platform's command modifier: ⌘B on Apple
platforms and Ctrl+B elsewhere, so macOS keeps Ctrl+B for moving the caret. It also stands aside
for a keydown another handler already prevented (an editor's bold), one mid-composition and one
typed into a text field. `Sidebar.Trigger` declares the shortcut in `aria-keyshortcuts`.
