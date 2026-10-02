---
"@elmeragroup/fuse": minor
---

`@elmeragroup/fuse` ships `NavigationMenu`, a site navigation bar built on Base UI's navigation
menu. It has seven parts: `Root`, `List`, `Item`, `Trigger`, `Content`, `Link` and `Indicator`.
`NavigationMenu.Root` renders the `<nav>` landmark and the one popup that every `Content` opens
into. `align` places that popup under the open trigger, and `container` sets the portal target.
A `Trigger` opens on hover, click, Enter or ArrowDown, and its caret turns while open.
`NavigationMenu.Link` with `active` marks the current page with `aria-current="page"`.
