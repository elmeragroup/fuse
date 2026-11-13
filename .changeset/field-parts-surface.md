---
"@elmeragroup/fuse": patch
---

The `Field.Separator` label and the inline `TextField`'s hover, focus and invalid fill now paint the
fill of the host they rest on, `var(--surface, var(--background))`, instead of the page colour. In
a Card, `Frame.Panel`, Dialog, Popover or any other host that states `--surface`, the "or" label no
longer shows a tinted chip on white in branded light themes or a page-coloured chip on a lighter
Card in dark themes, and a hovered or focused inline field no longer shows a page-coloured box.
The label's text is the host's muted text, `var(--surface-muted-foreground, var(--muted-foreground))`,
so it keeps 4.5:1 on the soft fill of a warning or info Alert. On the page both look as before.
