---
"@elmeragroup/fuse": patch
---

`Command.Root` starts fresh when `Command.Content` opens again before its close animation ends.
Before, such an opening kept the previous query, page and highlighted row. Now an uncontrolled
query goes back to `defaultValue`, an uncontrolled stack goes back to `defaultPages`, the
highlight goes back to the first match and the parts passed as `Command.Content`'s children mount
again, as after a finished close. The popup itself stays. `Command.Trigger` and anything else outside `Command.Content` keep their state.
A controlled stack stays as the consumer sets it, so an app that sets it back to the first page in
`onOpenChangeComplete` should do so in `onOpenChange` as the palette opens, which also covers an
opening that interrupts the close.
