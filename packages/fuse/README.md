# Fuse

`@elmeragroup/fuse` is the Elmera Group component library: whitelabel React components for the energy brands and corporate Elmera. One package, 24 theme permutations, ESM-only.

## Tailwind v4

Requires Tailwind CSS 4.1 or newer. Published code is not scanned by a consumer Tailwind pipeline unless you point `@source` at the **installed package root** (there is no nested `dist/` folder after install):

```css
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@import "@elmeragroup/fuse/themes.css";
@source "../node_modules/@elmeragroup/fuse";
```

Adjust the `@source` path only when the stylesheet is not one directory below the app root.

### What `fuse/css` changes in your theme

`@elmeragroup/fuse/css` is not only the components' variants and control metrics. Importing it into a Tailwind build also changes these parts of the host theme, whether or not `themes.css` is imported:

- **Role and primitive colours.** Its `@theme inline` block maps every role token (`--color-primary` → `var(--primary)` and so on) and remaps Tailwind's `neutral-50` to `neutral-950` palette onto `--neutral-*`. `themes.css` defines those; without it, `bg-neutral-200` and the other stock neutral utilities resolve to an undefined colour until you define `--neutral-*` yourself.
- **Radius scale.** `rounded-xs` to `rounded-xl` become whole `--radius-step` multiples from `--radius` instead of Tailwind's fixed rems. The step falls back to `0px`, so with your own `--radius` and no `themes.css` every rung is that one radius; `--radius` itself has no fallback. Button rounds with `--radius-button`, which `themes.css` sets per theme; define it (`--radius-button: var(--radius)`) when you skip `themes.css`. Field boxes round with `--radius` until `--radius-step` is `2px`, and then with `--radius-field`.
- **State variants.** It declares `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal` and `data-vertical` as static variants, wrapped in `:where()`. They replace Tailwind's functional `data-*` variants of the same name in your own classes too: their specificity drops to one class, so a plain `hover:` rule beats a `data-selected:` rule, `data-open:` and the like also match Radix-style `data-state` values, and `data-selected:` matches only `data-selected="true"`. Other `data-*` names are untouched.
- **Also:** `enabled-hover:`, `enabled-active:`, `disabled-state:`, `hit-area-*`, `no-scrollbar`, the `rounded-button`, `font-sans`, `font-heading` and `font-mono` utilities, the `xs`, `lg` and `3xl` breakpoints, `--spacing: 0.25rem`, the `overshoot` easing, `tw-animate-css`, the React Aria Tailwind plugin, and a reduced-motion rule that switches off transform and layout transitions document-wide.

### Keeping your own tokens

A host that migrates one component at a time can keep its own design tokens and skip `themes.css`:

```css
@import "tailwindcss";
@import "@elmeragroup/fuse/css";
@source "../node_modules/@elmeragroup/fuse";

@theme {
  /* Your tokens. This block comes after fuse/css, so where both define a theme variable, yours wins. */
}

:root {
  /* Map the role tokens the components you use read, in any colour notation. */
  --primary: var(--your-brand);
  --primary-foreground: #fff;
  --radius: 0.5rem;
  --radius-button: var(--radius);
}
```

Import `fuse/css` before your own `@theme` so your values win where both define one. Each component page in the docs lists the tokens that component reads under "Tokens consumed"; map those, and add the next component's list when you adopt it. Role tokens are whole colours (`oklch()`, `hsl()`, hex), not channel triplets.

Button's `outline` variant reads `--button-outline` and `--button-outline-width`. Without them it draws a 1px hairline in your `--border`, as internal themes do. For the external themes' outline, a 2px ring in the text colour with no shadow, set both:

```css
:root {
  --button-outline: var(--foreground);
  --button-outline-width: 2px;
}
```

Field boxes round with your `--radius`, as internal themes do. For the external themes' 4px field corner, set the external step and the field radius. The step also spreads the `rounded-*` scale in 2px steps around `--radius` and gives the checkbox and the calendar their external 4px corner:

```css
:root {
  --radius-step: 2px;
  --radius-field: 0.25rem;
}
```

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
