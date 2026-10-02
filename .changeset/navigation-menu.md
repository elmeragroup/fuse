---
"@elmeragroup/fuse": minor
---

`@elmeragroup/fuse` ships `NavigationMenu`, a site navigation bar built on Base UI's navigation
menu. It has eight parts: `Root`, `List`, `Item`, `Trigger`, `Content`, `Link`, `Viewport` and
`Indicator`. `NavigationMenu.Root` renders the `<nav>` landmark and the one popup that every
`Content` opens into. `side` and `align` place that popup against the open trigger, under it by
default, and `container` sets the portal target. A Root nested in a `Content` is a submenu:
`side="right"` opens it beside its trigger, and `inline` renders no popup, so its content shows
in a `NavigationMenu.Viewport` placed inside it. A trigger in a vertical Root is a full-width row.
A `Trigger` opens on hover, click, Enter or ArrowDown. Its caret points to the side its popup
opens on and turns while open in a bar; a trigger in an `inline` Root has no caret.
`NavigationMenu.Link` with `active` marks the current page with `aria-current="page"`.
