# Theme integration

Host setup recipes for `@elmeragroup/ui/theme`. The [theme contract](spec/theming.md#7-theme-provider-api) owns provider behavior and first-paint requirements. Next App Router and Vite have fixture coverage; the other frameworks below remain written guidance.

## Shared setup

Minimal app setup (Next App Router shape; every host follows the same split):

```tsx
import {
  ColorSchemeScript,
  ElmeraGroupUiProvider,
  ThemeProvider,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import "@elmeragroup/ui/styles.css";
import "@elmeragroup/ui/themes.css";

const theme = { variant: "external", brand: "fkas", segment: "private" } as const;
const colorScheme = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const;

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
      </head>
      <body>
        <ThemeProvider
          theme={theme}
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
          injectColorSchemeScript={false}>
          <ElmeraGroupUiProvider locale="nb-NO">{children}</ElmeraGroupUiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Token-backed canvas (required on every host so a missing attribute cannot flash the UA default):

```css
html,
body {
  background: var(--background);
  color: var(--foreground);
}
```

`suppressHydrationWarning` on `<html>` is required wherever the color-scheme script mutates `data-theme` before hydration. Brand attributes match on server and client and do not themselves require it. Apps that omit color-scheme machinery omit the script, the warning, and the provider color-scheme props. RAC consumers replace `ElmeraGroupUiProvider` with `UiProviders` from `@elmeragroup/ui/react-aria/ui-providers`; they do not nest both locale providers. `UiProviders` requires a function-valued `navigate` prop, so a Next App Router layout renders a small app-owned `"use client"` wrapper that calls `useRouter()` and passes `url => router.push(url)` — it does not pass a server function through the layout boundary.

## Host recipes

The library does not ship per-framework entries. Each named host places **brand attributes** and the **closed classic bootstrap** in a host-owned location **before any paintable application content**. `ThemeProvider` is context + runtime echo, not a universal first-paint adapter.

Shared invariants for every recipe:

- One resolved `theme` object to `themeAttributes` and `ThemeProvider`.
- One resolved density on the document root via `densityAttributes(defaultDensityForVariant(theme.variant))` (or an already-resolved override of that primitive). `ThemeProvider` and `ThemeScope` have no `density` prop. Forwarding `data-density` as a DOM attribute onto a ThemeScope host is allowed for the docs preview sandbox; it is not library nested density.
- Matching color-scheme literals to the bootstrap and the provider, including document-level `forcedColorScheme` when used.
- Import `themes.css` (and the chosen JS stylesheet). Set a token-backed `html, body { background: var(--background) }` so the UA canvas cannot flash.
- `suppressHydrationWarning` on `<html>` wherever a color-scheme script mutates `data-theme` on a React-owned document.
- `injectColorSchemeScript={false}` unless the host has no other place to put a classic script and can guarantee the injected node is first.
- Never a client-rendered `createRoot` `<script>`, never a copied generated IIFE checked into source, never `style.colorScheme`, never `<meta name="color-scheme">`, never cookie persistence, never hash-CSP.

Verified guarantees vs written guidance:

| Host                           | Status                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Next App Router                | **Fixture-verified** (`apps/docs` production HTML + delayed-hydration / JS-disabled / nonce probes)                                          |
| Vite / pure CSR                | **Fixture-verified** (`apps/static-theme` production HTML + React-blocked probes). That app is not `fixtures/vite` and is not a publish gate |
| Next Pages                     | Documented recipe only. Do not claim verified no-flash                                                                                       |
| TanStack Start                 | Documented recipe only. Do not claim verified no-flash                                                                                       |
| React Router 7 (framework/SSR) | Documented recipe only. Do not claim verified no-flash                                                                                       |

Route-specific forced **first paint** is a **document-adapter** job: a distinct root layout, `_document`, HTML entry, or `transformIndexHtml` path that knows the route’s force at HTML-generation time and passes the same primitive to bootstrap and provider. Descendant `<ForceColorScheme>` is **runtime-only** (hydration and later). Do not document it as a no-flash page lock.

### Next App Router (fixture-verified)

Root layout spreads `{...themeAttributes(theme)}` and `{...densityAttributes(defaultDensityForVariant(theme.variant))}` on `<html>` and passes that same `theme` to `ThemeProvider`. Place server-rendered `ColorSchemeScript` in `<head>` **or** as the first child of `<body>` before SkipNav/shell. This repo’s docs fixture uses `<head>`: Next App Router injects a hidden streaming preamble as the first body node, so first-in-`<body>` is not first paint on that host. `injectColorSchemeScript={false}`. `suppressHydrationWarning` on `<html>`. Token-backed canvas as above.

A route that must first-paint forced dark uses a route-group layout (or equivalent document) that passes `forcedColorScheme` into **both** `ColorSchemeScript` and `ThemeProvider`. A page-level `<ForceColorScheme value="dark">` does not change the first frame.

### Next Pages (recipe only)

`pages/_document` owns first paint. `_app` cannot stamp `<html>` and must not be asked to.

```tsx
// pages/_document.tsx
import { Head, Html, Main, NextScript } from "next/document";
import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "../lib/theme";

export default function Document() {
  return (
    <Html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <Head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// pages/_app.tsx
import type { AppProps } from "next/app";
import { ThemeProvider } from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "../lib/theme";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      theme={theme}
      storageKey={colorScheme.storageKey}
      defaultColorScheme={colorScheme.defaultColorScheme}
      enableSystem={colorScheme.enableSystem}
      injectColorSchemeScript={false}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
```

The classic script may live in `<Head>` or as the first body child ahead of `<Main />`. Token-backed canvas belongs in the global stylesheet. Route-specific force is a distinct `_document` (or equivalent) that passes the same `forcedColorScheme` into the script and the `_app` provider.

### TanStack Start (recipe only)

Root document shell spreads `themeAttributes(theme)` and `densityAttributes(defaultDensityForVariant(theme.variant))` on `<html>`. Place `ScriptOnce` with `colorSchemeScriptSource(colorScheme)` **before** children and module scripts. Pass the same `theme` and color-scheme literals to `ThemeProvider` with injection off. `suppressHydrationWarning` on `<html>`. Token-backed canvas as above.

```tsx
import { ScriptOnce } from "@tanstack/react-router";
import {
  colorSchemeScriptSource,
  defaultDensityForVariant,
  densityAttributes,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "./theme";

export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ScriptOnce>{colorSchemeScriptSource(colorScheme)}</ScriptOnce>
      </head>
      <body>
        <ThemeProvider theme={theme} {...colorScheme} injectColorSchemeScript={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`colorSchemeScriptSource` is called at document-render time and returns closed IIFE text; do not import an apply function through the app graph. Route-specific force is a document that passes the same `forcedColorScheme` into `colorSchemeScriptSource` and `ThemeProvider`.

### React Router 7 framework/SSR (recipe only)

Root `Layout` spreads `themeAttributes(theme)` and `densityAttributes(defaultDensityForVariant(theme.variant))` on `<html>` and renders `ColorSchemeScript` in `<head>` (parser-time) before `Meta`/`Links` content that depends on the marker. Same `theme` and color-scheme literals on `ThemeProvider`, injection off. Cookie/loader color state is a later optional SSR adapter; this wave does not persist color scheme in cookies.

```tsx
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  ThemeProvider,
  themeAttributes,
} from "@elmeragroup/ui/theme";
import { colorScheme, theme } from "./theme";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      {...themeAttributes(theme)}
      {...densityAttributes(defaultDensityForVariant(theme.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider
          theme={theme}
          storageKey={colorScheme.storageKey}
          defaultColorScheme={colorScheme.defaultColorScheme}
          enableSystem={colorScheme.enableSystem}
          injectColorSchemeScript={false}>
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

Token-backed canvas in the root stylesheet. Route-specific force is a layout that emits the same `forcedColorScheme` on the head script and the provider.

### Vite / pure CSR (fixture-verified)

Brand attributes are substituted into `index.html` at **build time**. Color scheme is a **raw classic** inline script in that file **before** the module bundle. First paint must not depend on `createRoot`: React 19 creates client `<script>` nodes that do not execute.

The proven adapter is Vite’s `transformIndexHtml` hook (`order: "post"`) in `vite.config.ts`:

1. Import `themeAttributes`, `defaultDensityForVariant`, `densityAttributes`, and `colorSchemeScriptSource` from `@elmeragroup/ui/theme` **in the Vite config**, not from the client graph. Call them at config/build time with the same `DOCUMENT_THEME` / `DOCUMENT_COLOR_SCHEME` the React tree will receive. This import resolves into the built `dist` output, which is why the workspace lint task depends on the UI package build having run first (`import/no-cycle` resolves imports).
2. Stamp the three brand attributes and `data-density` on `<html>`. Source HTML must not already contain them; the adapter throws with a clear message if the opening `<html>` tag already has `data-theme-variant`, `data-theme-brand`, `data-theme-segment`, or `data-density`. It does not strip-and-restamp.
3. Inject `<script>${colorSchemeScriptSource(options)}</script>` immediately before the first `type="module"` tag. Do **not** hand-copy the generated IIFE into `index.html`. Do **not** render `ColorSchemeScript` from `createRoot`.
4. Token CSS that **defines** `--background` must precede that parser-blocking script. Vite production builds often emit the hashed `themes.css` link at or after the module entry; hoist those `rel="stylesheet"` links to immediately before the bootstrap. Keep `html, body { background: var(--background) }`.
5. Mount `ThemeProvider` with the same theme and color-scheme literals and `injectColorSchemeScript={false}`.
6. A bundling Vite config loader can rewrite `Function.prototype.toString()` and break the closed IIFE. Keep the generator on the published module (this repo’s fixture uses `--configLoader native` and the packed `dist/theme.js` so workspace TypeScript source is not re-emitted).
7. Route-specific forced first paint is a second HTML entry (or a transform that inspects the filename/URL) that passes the same `forcedColorScheme` into `colorSchemeScriptSource` and `ThemeProvider`.

`apps/static-theme` is the verified private workspace proof of this recipe. It is not `fixtures/vite` and not a release packed-consumer gate.
