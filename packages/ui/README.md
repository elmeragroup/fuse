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
import {
  ColorSchemeScript,
  ElmeraGroupUiProvider,
  ThemeProvider,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/ui/theme";
```

Brand is a controlled host value: spread `themeAttributes(theme)` on `<html>` and pass the same object to `ThemeProvider`. Stamp density with `densityAttributes(defaultDensityForVariant(theme.variant))` on the same document root — both `dense` and `comfortable` are explicit. Color scheme uses a host-placed `ColorSchemeScript` or `colorSchemeScriptSource` **before** paintable content — the provider is not a first-paint adapter (`injectColorSchemeScript` defaults false). Next App Router and Vite recipes are fixture-verified; Next Pages, TanStack Start, and React Router 7 are written recipes only. Full recipes: [theming.md](../../docs/spec/theming.md) §7.3.

Workspace apps import the same public subpaths. Do not deep-import `src/` internals.

## Flag assets

PhoneNumberField and `@elmeragroup/ui/flags` use local external SVG images. Vite 8.2.1 production builds preserve them with default asset settings, including a non-root `base`; no `assetsInlineLimit` override is needed. The generated URLs include a `?no-inline` asset hint before bundling. Treat each value as an opaque image URL. Other bundlers must preserve external URL assets or disable asset inlining in their configuration.
