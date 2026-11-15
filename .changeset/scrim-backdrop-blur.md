---
"@elmeragroup/fuse": minor
---

`Dialog.Content`, `AlertDialog.Content`, `Sheet.Content`, `Dialog.Overlay` and `Sheet.Overlay` take
`backdropBlur`, which defaults to `true`. Set it to `false` for an overlay portaled into a
transformed scope, such as a zoomable canvas or an artboard. There the scrim's blur samples shifted
content, and the blurred copy no longer lines up with the page. The scrim keeps its tint either
way.
