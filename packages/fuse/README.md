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
- **Radius scale.** `rounded-xs` to `rounded-xl` become whole `--radius-step` multiples from `--radius` instead of Tailwind's fixed rems. The step falls back to `0px`, so with your own `--radius` and no `themes.css` every rung is that one radius; `--radius` itself has no fallback. Button rounds with `--radius-button`, which `themes.css` sets per theme; define it (`--radius-button: var(--radius)`) when you skip `themes.css`. Field boxes round with `--radius` until `--radius-step` is `2px`, and then with `--radius-field`, which `themes.css` aliases to `var(--radius)` on each theme element.
- **State variants.** It declares `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal` and `data-vertical` as static variants, wrapped in `:where()`. They replace Tailwind's functional `data-*` variants of the same name in your own classes too: their specificity drops to one class, so a plain `hover:` rule beats a `data-selected:` rule, `data-open:` and the like also match Radix-style `data-state` values, and `data-selected:` matches only `data-selected="true"`. Other `data-*` names are untouched.
- **Border colour.** A base-layer rule gives every element, host markup included, `border-color: var(--border, currentcolor)`, so a bare `border` draws in the border role instead of the text colour. Native form widgets (`button`, `input`, `select`, `textarea`, `progress`, `meter`) outside Fuse parts are skipped and keep their own border colour and native look; with preflight, a bare `border` on them stays `currentcolor`, so add `border-border` where you want the role. Any border colour utility still wins, and a host base rule like `* { @apply border-border; }` can go unless it colours those widgets. Import `fuse/css` after `tailwindcss`; a preflight-free build that imports Tailwind's sheets into layers declares `@layer theme, base, components, utilities;` before them.
- **Also:** `enabled-hover:`, `enabled-active:`, `disabled-state:`, `hit-area-*`, `no-scrollbar`, the `rounded-button`, `rounded-inner`, `font-sans`, `font-heading` and `font-mono` utilities, the `xs`, `lg` and `3xl` breakpoints, `--spacing: 0.25rem`, the `overshoot` easing, `tw-animate-css`, the React Aria Tailwind plugin, and a reduced-motion rule that switches off transform and layout transitions document-wide.

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

A `Card` and a `card` Accordion item draw their edge in `--card-border`, and a `Card` casts its small shadow in `--card-shadow`. Without them they take your `--border` and Tailwind's 5% black shadow, as internal themes do, and `CheckboxCard` and the TextField `card` box always do. For the external themes' look, where a card stands on the page by its fill alone, set both to a transparent colour. The border keeps its 1px width, so the layout does not move, but a card on a `--card`-coloured surface, such as a nested `Card`, has no outline:

```css
:root {
  --card-border: oklch(0 0 0 / 0);
  --card-shadow: oklch(0 0 0 / 0);
}
```

The line between a card's stacked `Card.Section` and `Card.SectionButton` parts is `--card-section-divider`. Without it, it takes your `--border`. External themes draw it in the page tint, `var(--background)`.

A `RadioItem` or `CheckboxItem` row draws its edge in `--selection-border`, and a checked row in `--selection-checked-border`. The line between stacked rows reads `--selection-divider`, and above and below a checked row `--selection-checked-divider`. Without them the row and its dividers take your `--border` and a checked row your `--primary`, as internal themes do. For the external themes' look, where stacked rows keep a grey separator but no outer edge and the control alone shows the selection, set the edge to a transparent colour, point the checked edge at it, and draw both dividers in `--border`. The border keeps its 1px width, so rows join and inset as before, but a row on a `--card`-coloured surface has no outline:

```css
:root {
  --selection-border: oklch(0 0 0 / 0);
  --selection-checked-border: var(--selection-border);
  --selection-divider: var(--border);
  --selection-checked-divider: var(--selection-divider);
}
```

A disabled `RadioItem` or `CheckboxItem` row, disabled itself or through its group, fills with `--selection-disabled-background` under a 45° hatch striped in `--selection-disabled-hatch`, its title and other label row text take `--selection-disabled-foreground`, and its control dims to 50%. Without them the row takes your `--muted` under black stripes at 2% alpha with `--foreground` text, as internal themes do. For the external themes' look, where a disabled row keeps the card fill of an enabled row, draws no stripes and greys its title, set:

```css
:root {
  --selection-disabled-background: var(--card);
  --selection-disabled-hatch: oklch(0 0 0 / 0);
  --selection-disabled-foreground: var(--muted-foreground);
}
```

The checked row's tint and the disabled fill win over a background class on the row, such as `bg-background` for a list that shows its surface through. For such a list, set the disabled fill to that surface too:

```css
.plan-list {
  --selection-disabled-background: var(--background);
}
```

`RadioItem` and `CheckboxItem` row titles read `--selection-title-weight`. Without it they are 400, as internal themes set them. For the external themes' medium title, which matches the group legend and `CheckboxCard` titles, set:

```css
:root {
  --selection-title-weight: 500;
}
```

A `Text` at `sm`, the default size and `lg` reads its line height from `--paragraph-leading-sm`, `--paragraph-leading-base` and `--paragraph-leading-lg`. Without them it keeps the relaxed 1.625 ratio, as internal themes do. For the external themes' paragraph styles, 14/20, 16/22 and 18/24, set:

```css
:root {
  --paragraph-leading-sm: 1.25rem;
  --paragraph-leading-base: 1.375rem;
  --paragraph-leading-lg: 1.5rem;
}
```

A `leading` prop or a `className` leading on the Text replaces the role. `Span` keeps its own snug default.

`Dialog.Content`, `AlertDialog.Content` and `Sheet.Content` fill with `--dialog` and take `--dialog-foreground` as their text colour. Without them a modal takes your `--popover` and `--popover-foreground`, as internal themes and every dark theme do. For the external light look, where a modal fills with the page tint so the card-coloured fields and selection rows inside it stand apart as they do on the page, set the pair in your light rules and point it back at the popover pair in your dark ones, as the themes do:

```css
:root {
  --dialog: var(--background);
  --dialog-foreground: var(--foreground);
}

.dark /* your dark-scheme selector */ {
  --dialog: var(--popover);
  --dialog-foreground: var(--popover-foreground);
}
```

Field boxes round with your `--radius`, as cards and the themes' fields do. For the external look, set the external step. It spreads the `rounded-*` scale in 2px steps around `--radius` and gives the calendar its external 4px corner. Fields then round with `--radius-field` where you set one, and with your `--radius` otherwise, so set it only for a field corner of your own:

```css
:root {
  --radius-step: 2px;
}
```

## Non-Tailwind

```css
@import "@elmeragroup/fuse/styles.css";
@import "@elmeragroup/fuse/themes.css";
```

The standalone stylesheet includes library utilities without Tailwind preflight, plus the base-layer border-colour default described above, which leaves host native form widgets and their native look untouched.
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
