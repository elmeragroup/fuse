# Docs theme compliance

Implemented 2026-09-15. The docs shell consumes `internal × elma × private` from `@elmeragroup/ui/theme` in both light and dark mode.

## Cause and fix

The document already stamped the correct variant, brand and segment. Its body and shared components still used a separate docs palette, including `bg-white`, `font-docs-sans` and `scheme-light`. Those utilities prevented the page from following the library's dark tokens.

The [route layout](<../../../apps/docs/src/app/(docs)/layout.tsx>) now uses:

```tsx
<body className="m-0 min-w-80 bg-background font-sans text-foreground antialiased">
```

`DocumentRoot`, `ColorSchemeScript` and `ThemeProvider` retain the existing library integration. Setting `data-theme="dark"` directly on `<html>` changes the whole docs page through CSS. The scheme bootstrap also respects stored preferences and system settings before hydration. The preview picker controls the demo's brand, variant and segment; the document stays internal Elmera private.

## Audit scope and mapping

Reviewed all 418 files under `apps/docs/src/app/(docs)`, the 35 shared component files, and the global stylesheet. This includes authored MDX pages, demos, API data and the components that render those pages.

| Element                         | Library roles and utilities                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Document, shell and header      | `background`, `foreground`, `border`                                                   |
| Navigation and secondary labels | `muted-foreground`, `accent`, `accent-foreground`, `ring`                              |
| Prose                           | All active Typography color roles mapped to library tokens, including keyboard shadows |
| Code blocks and inline code     | `card`, `muted`, `border`, `sh-*`, `font-mono`                                         |
| Headings and body text          | `font-heading`, `font-sans`, standard Tailwind type scale                              |
| API tables and required markers | `border`, `card`, `muted`, `foreground`, `error`                                       |
| Server badge                    | `success`, `success-soft`, `success-soft-foreground`                                   |
| Theme selectors                 | `input`, `card`, `card-foreground`, `ring`, library control sizing                     |
| Search                          | Library `Button` and `Dialog`, `popover` pair, accent selection                        |
| Rounded panels and controls     | Library radius utilities                                                               |

Removed the docs color/font definitions from `globals.css`. The remaining docs-specific variable controls header height. The header uses two rows below 40rem so the theme controls and Search fit at mobile widths. Demo metadata wraps without joining labels together.

Layout measurements, transparent/inherited colors and image content remain valid. Avatar demo SVGs contain fixed portrait colors. Token swatches deliberately set their fill from the token being demonstrated. Neither creates a separate UI palette.

The source guard checks route TS/TSX/MDX and shared components for docs palette classes, fixed Tailwind palette colors and forced light/dark schemes. The docs-site specification now requires the library palette.

## Validation

- Reproduced the original failure with a browser test: after setting `data-theme="dark"`, the body stayed white while `--background` resolved dark. The same test now passes.
- Docs production build passed.
- Full docs unit suite passed, 20 files and 389 tests.
- Full docs browser suite passed, 9 files and 38 tests. Coverage includes manual light/dark/light changes on four routes, token and font resolution, dark search overlays, theme preview isolation, stored/system preferences, and pre-hydration first paint.
- Docs TypeScript, repository strict lint, formatting and diff whitespace checks passed.
- Visual review confirmed light and dark component pages and the search dialog. At viewport widths of 320, 390 and 640 pixels, document scroll width equals viewport width and every header control stays visible.

The audit verifies docs token use and theme integration. Browser assertions sample the home page, theming handbook, theme matrix and Button page; source guards and route checks cover the wider tree.

## Previews

- [Light docs](../../../notes/docs-internal-elma-light.png)
- [Dark docs](../../../notes/docs-internal-elma-dark.png)
