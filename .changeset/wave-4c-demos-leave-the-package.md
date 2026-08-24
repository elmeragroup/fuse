---
"@elmeragroup/ui": patch
---

Move the component demos out of the package into the docs app. `styles.css` shrinks (9905 → 9758 gzip) because demo-only classes no longer leak into the standalone stylesheet through Tailwind's automatic source detection; no runtime or public API change.
