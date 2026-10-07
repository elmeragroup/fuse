---
"@elmeragroup/fuse": minor
---

`Toast.Viewport` takes a `placement` prop: `"top-left"`, `"top-center"`, `"top-right"`, `"bottom-left"`,
`"bottom-center"` or `"bottom-right"`, the default. Placement applies from the `sm` breakpoint up. A top
placement stacks toasts downward from the top edge and slides them in from above. Toasts dismiss by
swiping toward the edge they sit on and toward their side, or right for a centered stack. An explicit
`swipeDirection` on `Toast.Root` still wins. Below `sm` every placement keeps today's layout: the stack
sits at the bottom, spans the screen width and swipes down or right. If you moved the stack by overriding
inset classes such as `className="sm:inset-x-0"`, remove the override and pass `placement`.

Toasts now stay inside the viewport column when you use the standalone CSS without Tailwind's
preflight. Before, the toast's padding widened it 32px past the column, which pushed it off the left
edge of a narrow screen.
