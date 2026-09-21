---
"@elmeragroup/fuse": patch
---

`Toast.Title` and `Toast.Description` on the error, info, success and warning statuses now render in
the paired `<status>-soft-foreground` role over the soft fill: the title inherits the root's colour,
and the description resolves the `--toast-copy` variable the root publishes. Titles no longer paint
the raw `<status>` role and descriptions no longer fall back to the neutral `muted-foreground`, so
both stay at the text-grade contrast the palette guarantees. Neutral and loading toasts keep
`muted-foreground`, a consumer `className` on either slot still wins, and the status icons keep the
raw `<status>` accent. Light themes look unchanged; dark copy may render a different colour.
