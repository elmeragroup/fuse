---
"@elmeragroup/fuse": patch
---

`ToggleGroup.Root` types `style` as plain `CSSProperties`. A Base UI state callback was never
applied at runtime because it was spread into an object. It is now a type error, making the
silent drop visible at compile time.
