---
"@elmeragroup/fuse": patch
---

Event handlers you pass to a Fuse part now run before the library's own handler for that event, in
Base UI's order, so your handler can call `event.preventBaseUIHandler()` to skip it. The one library
handler whose order changes is `Button`'s focus suppression under `isVisuallyDisabled`: an
`onMouseDown` you pass now runs before the button suppresses focus on press. Before, the library's
handler ran first. This reaches `Button` and every component that forwards `isVisuallyDisabled` to
it: `ConfirmButton`, `InputGroup.Button`, `PopoverInfoButton` and `Sidebar.Trigger`. Base UI's own
handlers already ran after yours.

Forwarding a prop as `undefined` (`aria-labelledby={undefined}`, `id={undefined}`,
`aria-disabled={undefined}`) no longer erases Base UI's automatic wiring on any part: an undefined
prop now counts as not passed, so Field's label, description and control id and Base UI's own
`aria-disabled` stay in place. Before, only some components guarded against it.
