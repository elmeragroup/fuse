---
"@elmeragroup/fuse": patch
---

The `tailwindcss` peer range is now `^4.1`. Fuse's classes use the 4.1 utilities `wrap-anywhere`
and `wrap-break-word`, which Tailwind 4.0 does not generate, so the published `^4` let a 4.0
install drop them silently.

Published dependency ranges now follow the versions Fuse is tested with: `tailwind-merge` is
`^3.7.0`, `tailwind-variants` `^3.3.1`, `@internationalized/date` `^3.12.4` and
`libphonenumber-js` `^1.13.13`. Base UI, React Aria, React Aria Components, Phosphor and
`tailwindcss-react-aria-components` stay exact pins, and `sugar-high` stays at `^2.4.0`.
