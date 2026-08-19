# `@elmeragroup/ui`

Whitelabel React components for Elmera Group's energy brands and corporate Elmera. One package, 20 theme permutations, ESM-only.

## Tailwind v4

Published code is not scanned by a consumer Tailwind pipeline unless you point `@source` at the **installed package root** (there is no nested `dist/` folder after install):

```css
@import "tailwindcss";
@import "@elmeragroup/ui/css";
@import "@elmeragroup/ui/themes.css";
@source "../node_modules/@elmeragroup/ui";
```

Adjust the `@source` path only when the stylesheet is not one directory below the app root.

## Non-Tailwind

```css
@import "@elmeragroup/ui/styles.css";
@import "@elmeragroup/ui/themes.css";
```

## JavaScript

```ts
import { ThemeProvider, ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";
```

Workspace apps import the same public subpaths. Do not deep-import `src/` internals.
