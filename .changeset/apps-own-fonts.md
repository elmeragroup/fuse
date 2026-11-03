---
"@elmeragroup/fuse": minor
---

Themes no longer set fonts. Fuse sets body text in `--font-sans` and headings in `--font-heading`,
and an app loads its fonts and sets both variables in its own CSS, Fjordkraft's Neo Sans heading
included. Before, every theme named Roboto, and the external Fjordkraft themes named Neo Sans for
headings. Both variables now default to the system font stack, `ui-sans-serif, system-ui,
sans-serif`, in the `theme` layer, so an app's own rule sets them without `!important`:

```css
:root {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
}

[data-theme-brand="fkas"] {
  --font-heading: var(--font-neo-sans), var(--font-sans);
}
```

The theme catalog drops the `font-sans` and `font-heading` tokens and the `fontFamily` token kind.
The standalone `styles.css` now imports Tailwind's theme variables in the `theme` layer, as a
Tailwind-source build does, so an app's layered rules override them too. The Fonts handbook page
has recipes for Next.js, `@fontsource` and `@font-face`.
