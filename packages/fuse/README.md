# Fuse

`@elmeragroup/fuse` is the Elmera Group component library: whitelabel React components for the energy brands and corporate Elmera. One package, 20 theme permutations, ESM-only.

## Tailwind v4

Requires Tailwind CSS 4.1 or newer. Published code is not scanned by a consumer Tailwind pipeline unless you point `@source` at the **installed package root** (there is no nested `dist/` folder after install):

```css
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@import "@elmeragroup/fuse/themes.css";
@source "../node_modules/@elmeragroup/fuse";
```

Adjust the `@source` path only when the stylesheet is not one directory below the app root.

### Scanning one component at a time

Pointing `@source` at the package root generates CSS for the whole library. An app that adopts one component at a time can import that component's generated source stylesheet instead, which declares `@source` for exactly the published files the entry's classes live in, shared style owners included:

```css
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@import "@elmeragroup/fuse/themes.css";
@import "@elmeragroup/fuse/source/button.css";
@import "@elmeragroup/fuse/source/dialog.css";
```

There is one `@elmeragroup/fuse/source/<entry>.css` per component subpath, `theme`, `icons`, `illustrations`, `flags` and `react-aria/<entry>`, generated at build time from each entry's import graph and checked against the packed package. A refactor that moves a class into another file moves the `@source` line with it, so nothing depends on knowing the package layout. The package-root `@source` stays the default for apps that use most of the library.

## Non-Tailwind

```css
@import "@elmeragroup/fuse/styles.css";
@import "@elmeragroup/fuse/themes.css";
```

The standalone stylesheet includes library utilities without Tailwind preflight.
Keep your app's reset and import `themes.css` in either mode.

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

Brand is a controlled host value: spread `themeAttributes(theme)` on `<html>` and pass the same object to `ThemeProvider`. Stamp density with `densityAttributes(defaultDensityForVariant(theme.variant))` on the same document root — both `dense` and `comfortable` are explicit. Color scheme uses a host-placed `ColorSchemeScript` or `colorSchemeScriptSource` **before** paintable content — the provider is not a first-paint adapter (`injectColorSchemeScript` defaults false). Next App Router and Vite recipes are fixture-verified; Next Pages, TanStack Start, and React Router 7 are written recipes only. Full recipes: [theme integration](<../../apps/docs/src/app/(docs)/handbook/theming/page.tsx>).

Workspace apps import the same public subpaths. Do not deep-import `src/` internals.

## Custom properties

Component `style` props accept React's `CSSProperties`; to pass a custom property such as `--sidebar-width` without a cast, augment csstype's `Properties` interface in your app, with `csstype` installed so the augmentation resolves from the augmenting file — workspace apps inherit the augmentation from `@elmeragroup/typescript-config`.

## Flag assets

PhoneNumberField and `@elmeragroup/fuse/flags` use local external SVG images. Vite 8.2.1 production builds preserve them with default asset settings, including a non-root `base`; no `assetsInlineLimit` override is needed. The generated URLs include a `?no-inline` asset hint before bundling. Treat each value as an opaque image URL. Other bundlers must preserve external URL assets or disable asset inlining in their configuration.
