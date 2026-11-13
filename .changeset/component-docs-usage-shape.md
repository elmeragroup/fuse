---
"@elmeragroup/fuse": patch
---

`Form` now documents its submit rules on the props they concern. `errors` lists which fields show
the messages, when an error blocks the submit and when the form clears it. `onFormSubmit` lists the
values it receives and when the form skips it.

`ActionBar`, `Badge`, `ButtonGroup`, `ConfirmButton`, `Kbd`, `Link`, `Loader`, `Separator`,
`AspectRatio`, `Emoji` and `Code` now document their rules on the props they concern, so the API
reference and the markdown endpoint show them. `ActionBar.Root` documents its live announcement and
focus return on `count` and its placement on `offset`. `Link` documents `href`, `target`, `render`,
`underline`, `weight` and `truncate`. `Kbd` documents `aria-hidden` for a cap that repeats a
shortcut. `Badge`, `ConfirmButton`, `Link` and `Loader` declare the defaults they already had, so
the API reference shows them.
