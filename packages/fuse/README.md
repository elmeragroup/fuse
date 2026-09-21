# Fuse

`@elmeragroup/fuse` is the Elmera Group component library: whitelabel React components for the energy brands and corporate Elmera. One package, 20 theme permutations, ESM-only.

## Tailwind v4

Published code is not scanned by a consumer Tailwind pipeline unless you point `@source` at the **installed package root** (there is no nested `dist/` folder after install):

```css
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@import "@elmeragroup/fuse/themes.css";
@source "../node_modules/@elmeragroup/fuse";
```

Adjust the `@source` path only when the stylesheet is not one directory below the app root.

## Non-Tailwind

```css
@import "@elmeragroup/fuse/styles.css";
@import "@elmeragroup/fuse/themes.css";
```

## JavaScript

```ts
import {
  ColorSchemeScript,
  LocaleProvider,
  ThemeProvider,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/fuse/theme";
```

Brand is a controlled host value: spread `themeAttributes(theme)` on `<html>` and pass the same object to `ThemeProvider`. Stamp density with `densityAttributes(defaultDensityForVariant(theme.variant))` on the same document root — both `dense` and `comfortable` are explicit. Color scheme uses a host-placed `ColorSchemeScript` or `colorSchemeScriptSource` **before** paintable content — the provider is not a first-paint adapter (`injectColorSchemeScript` defaults false). Next App Router and Vite recipes are fixture-verified; Next Pages, TanStack Start, and React Router 7 are written recipes only. Full recipes: [theme integration](../../docs/theming-integration.md).

Workspace apps import the same public subpaths. Do not deep-import `src/` internals.

## Custom properties

Component `style` props accept React's `CSSProperties`; to pass a custom property such as `--sidebar-width` without a cast, augment csstype's `Properties` interface in your app, with `csstype` installed so the augmentation resolves from the augmenting file — workspace apps inherit the augmentation from `@elmeragroup/typescript-config`.

## Flag assets

PhoneNumberField and `@elmeragroup/fuse/flags` use local external SVG images. Vite 8.2.1 production builds preserve them with default asset settings, including a non-root `base`; no `assetsInlineLimit` override is needed. The generated URLs include a `?no-inline` asset hint before bundling. Treat each value as an opaque image URL. Other bundlers must preserve external URL assets or disable asset inlining in their configuration.
