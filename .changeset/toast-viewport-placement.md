---
"@elmeragroup/fuse": minor
---

`Toast.Viewport` takes a `placement` prop. `"bottom-right"`, the default, keeps the stack in the
bottom-right corner. `"bottom-center"` centers it along the bottom edge. Placement applies from the
`sm` breakpoint up; on narrower screens the stack spans the screen width either way. If you centered
the stack by overriding inset classes such as `className="sm:inset-x-0"`, remove the override and
pass `placement="bottom-center"`.
