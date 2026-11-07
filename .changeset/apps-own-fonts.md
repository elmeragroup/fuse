---
"@elmeragroup/fuse": minor
---

Themes no longer set fonts. Before, every theme named Roboto, and the external Fjordkraft themes
named Neo Sans for headings. Fuse still sets body text in `--font-sans` and headings in
`--font-heading`. Both default to the system font stack in the `theme` layer, so an app sets them in
its own CSS without `!important`. An app now loads its fonts and sets both variables, Fjordkraft's
Neo Sans headings included:

```css
:root {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}

[data-theme-identity="branded"][data-theme-brand="fkas"] {
  --font-heading: var(--font-neo-sans), var(--font-sans);
}
```

The theme catalog drops the `font-sans` and `font-heading` tokens and the `fontFamily` token kind.
The standalone `styles.css` now puts Tailwind's theme variables in the `theme` layer, as a
Tailwind-source build does. The fonts handbook page has recipes for Next.js, `@fontsource` and
`@font-face`.
