---
"@elmeragroup/fuse": minor
---

The theme's audience axis is now its **identity**, and a document always names its density.
External customer dashboards can now take the brand look at dense density, and a promo page in
the same app stays comfortable.

**Identity replaces variant.** `ThemeInput.variant` is now `identity`, with `internal` renamed
`neutral` and `external` renamed `branded`. The rename covers the attribute, the slugs and the
exports, with no aliases for the old names:

| Before                               | After                               |
| ------------------------------------ | ----------------------------------- |
| `{ variant: "internal", … }`         | `{ identity: "neutral", … }`        |
| `{ variant: "external", … }`         | `{ identity: "branded", … }`        |
| `data-theme-variant="internal"`      | `data-theme-identity="neutral"`     |
| `data-theme-variant="external"`      | `data-theme-identity="branded"`     |
| `internal-fkas-private` (theme slug) | `neutral-fkas-private`              |
| `external-fkas-private` (theme slug) | `branded-fkas-private`              |
| `ThemeVariant`, `THEME_VARIANTS`     | `ThemeIdentity`, `THEME_IDENTITIES` |

Migrate host CSS that selects on the old attribute, such as a font rule for branded Fjordkraft
headings:

```css
/* Before */
[data-theme-variant="external"][data-theme-brand="fkas"] {
  --font-heading: var(--font-neo-sans), var(--font-sans);
}

/* After */
[data-theme-identity="branded"][data-theme-brand="fkas"] {
  --font-heading: var(--font-neo-sans), var(--font-sans);
}
```

Stored or URL slugs that start with `internal-` or `external-` no longer parse: `parseThemeSlug`
returns `null` for them, so map them to `neutral-` and `branded-` when you read them.

**Density is explicit.** `defaultDensityForVariant` is gone: no identity implies a density. Stamp
the document root with the new `documentAttributes({ theme, density })`, which returns the
`data-theme-*` attributes and `data-density` together, and pass the density the page needs.
`densityAttributes(density)` stays for stamping density alone.

```tsx
// Before
<html {...themeAttributes(THEME)} {...densityAttributes(defaultDensityForVariant(THEME.variant))}>

// After: what the old default gave, spelled out
<html {...documentAttributes({ theme: THEME, density: "comfortable" })}>
```

The old default was `dense` for internal themes and `comfortable` for external ones, so pass those
to keep today's look. Density is per document, so an app with dense dashboards and comfortable
promo pages gives each group of routes its own root layout. ThemeProvider and ThemeScope still
never write density.

**Branded dense buttons pad their labels at 12px.** A branded button rounds with the brand's
button radius, often a pill. At dense density its label edges now take at least 12px of inline
padding, so the label clears the curve. Icon edges, square icon buttons and ButtonGroup members keep
their inset, and nothing changes for neutral themes or at comfortable density, where the padding is
already 12px or more. This is the only visual change.

**Corners no longer change in dark.** The radius roles, `--radius`, `--radius-button`,
`--radius-field` and `--radius-step`, are emitted in their own light-only rules, one per identity
and brand, and no dark rule restates them. The values are unchanged. A host `--radius` override on
the theme element now holds in dark as well as in light, where a dark rule used to outweigh an
override at the light rule's weight.

**Theme catalog.** A `ResolvedTheme` no longer has `defaultDensity`, and its `attributes` carry no
`data-density`.

**Figma.** The sync renames the `Fuse variant` collection to `Fuse identity`, and its `Internal`
and `External` modes to `Neutral` and `Branded`, in place, so frames keep their mode pins. The
`Auto` mode of `Fuse density` is removed, since no identity implies a density. A frame that used
`Auto` falls back to the collection's default mode, `Dense`, so repin branded frames that should
stay comfortable to `Comfortable`. The kit draws Button labels at the density inset and not the
branded dense 12px floor.
