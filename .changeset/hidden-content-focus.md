---
"@elmeragroup/ui": patch
---

Hidden sidebar panels and item footers are no longer reachable from the keyboard.

- Collapsed offcanvas `Sidebar` contents leave tab order and the accessibility tree. `Sidebar.Rail` stays a mouse-only control for reopening the panel.
- `Item.Footer` with `mode="hidden"` — and `SelectionItem.SubSection`, which forwards that mode — renders `inert` until the mode changes.
