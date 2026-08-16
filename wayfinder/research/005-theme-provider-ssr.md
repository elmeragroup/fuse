# Research 005 — Theme provider & SSR

Resolves [ticket 005](../tickets/005-theme-provider-ssr-research.md). Researched 2026-08-16 against primary sources: the `next-themes` source tree at v0.4.6 (`main` branch), its published dist on unpkg, React Router 7 docs, TanStack Router docs, remix-themes, and the shadcn dark-mode guides.

## TL;DR

- `next-themes` contains **zero Next.js-specific code** — three plain-React files, no `next` imports, MIT, ~1.5 kB gzipped. Vendoring it is trivially feasible.
- But it solves the **opposite problem to ours**: it exists to apply a theme the *server cannot know* (localStorage + `prefers-color-scheme`) without a flash. Our theme (variant × brand × segment) is **server-known and deployment-fixed** — rendering a class on the root element server-side, as both reference apps already do, is strictly better than anything next-themes can do (zero flash, zero JS, zero hydration warnings).
- **Verdict**: don't vendor next-themes for v1. Ship a tiny provider of our own (static context + pure slug helpers, no effects, no script), plus per-framework one-line recipes. Reserve a vendored copy of next-themes' 53-line `script.ts` for the roadmap's dark-mode toggle, which *is* the problem next-themes solves — bound to the `data-theme` axis the token contract already reserves.

---

## 1. How next-themes actually works

Source: [`next-themes/src`](https://github.com/pacocoursey/next-themes/tree/main/next-themes/src) — exactly three files: `index.tsx` (7.1 kB), `script.ts` (1.3 kB), `types.ts` (2.5 kB). Published dist (`unpkg.com/next-themes@0.4.6/dist/index.mjs`): 3.4 kB minified, **1.55 kB gzipped** (measured). Peer deps: `react` + `react-dom` only; zero runtime dependencies ([package.json](https://github.com/pacocoursey/next-themes/blob/main/next-themes/package.json)).

### The moving parts

**`ThemeProvider` / `Theme`** ([index.tsx](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/index.tsx)):
- State initialised lazily from `localStorage.getItem(storageKey)`; on the server the getter short-circuits (`if (isServer) return undefined`) — **SSR HTML never carries the theme**, and `useTheme().theme` is `undefined` during SSR. This is the root cause of the whole no-flash apparatus.
- `applyTheme` mutates `document.documentElement` in a `useEffect`: `class` (add/remove from a known list) and/or any `data-*` attribute (the `attribute` prop accepts `'class' | 'data-*' | Array` of both), optional `value` map from theme name → attribute value, optional `style.colorScheme` for native form controls.
- Listens to `matchMedia('(prefers-color-scheme: dark)')` for live system-preference changes and to the `storage` event for cross-tab sync.
- `disableTransitionOnChange` injects a temporary `transition: none !important` style during switches.
- Nested providers pass through children (single-provider guarantee).

**The no-flash script** ([script.ts](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/script.ts)) — the actual trick, 53 lines:
- A plain function serialized at render time via `script.toString()` and rendered as `<script suppressHydrationWarning dangerouslySetInnerHTML={{__html: \`(${script.toString()})(${args})\`}} />` with the config JSON-inlined as arguments (index.tsx, `ThemeScript`).
- Because inline scripts execute synchronously during HTML parsing, it reads `localStorage` (or `forcedTheme`), resolves `'system'` via `matchMedia`, and sets the class/attribute on `<html>` **before the browser paints any subsequent content**. The provider renders it at the top of its tree; `ThemeScript` is also a public export so it can be placed in `<head>` manually.
- React would flag the mismatch between server HTML (no attribute) and script-mutated DOM, hence the documented requirement to put `suppressHydrationWarning` on `<html>` ([README](https://github.com/pacocoursey/next-themes#readme)).
- CSP supported via a `nonce` prop; arbitrary `scriptProps` pass through.

### How Next-specific is it?

**Not at all — verified against the source.** `index.tsx` imports only `react` and its own two files; there is no `import ... from 'next/*'` anywhere in the package. The `'use client'` banner is a React Server Components directive, not a Next API. The README's line about injecting "a script into `next/head`" is historical phrasing — the current implementation is a plain inline `<script>` element rendered wherever the provider sits. The README itself confirms non-Next usage ("works with Gatsby or CRA" since 0.3.0). The *name* is the only Next-specific thing about it.

### Built-in light/dark assumptions (matters for us)

Multi-theme is supported (`themes: string[]`, `value` map), but the ergonomics are dark/light-shaped: `defaultThemes = ['light','dark']`, `enableSystem` defaults to `true`, `systemTheme` is typed `'dark' | 'light'`, `colorScheme` only ever gets `'light'`/`'dark'` ([index.tsx](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/index.tsx), [types.ts](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/types.ts)). Using it for 16 brand-theme slugs means switching those defaults off and ignoring half the API.

---

## 2. SSR-safe theming per framework

Two fundamentally different regimes:

| Regime | Server knows the theme? | Mechanism | Flash risk |
|---|---|---|---|
| **Server-known** (env var, cookie, host header) | Yes | Render attribute into `<html>`/root in SSR output | None, by construction |
| **Client-known** (localStorage, `prefers-color-scheme`) | No | Blocking inline script before first paint + `suppressHydrationWarning` | None if script precedes content |

next-themes is machinery for the second regime. Our deployments live in the first: **both reference apps set brand server-side via env var into the root className with zero client theme state** (local fact, established in reference-app exploration).

### Next.js (App Router)

- Server-known: `<html className={themeClass}>` in `app/layout.tsx`, value from `process.env`. Nothing else needed.
- Client-known: next-themes is the canonical answer; provider in root layout, `suppressHydrationWarning` on `<html>` ([next-themes README](https://github.com/pacocoursey/next-themes#readme)).

### React Router 7 (framework mode)

- Server-known: `root.tsx`'s `Layout` renders the document — `<html className={themeClass}>` directly, or from `loader` data if per-request (multi-tenant host) resolution is ever needed.
- Client-known / user preference: the canonical pattern is **cookies, not localStorage**, because the root loader can then render the correct attribute into the SSR payload — no inline script, no hydration suppression. RR7 ships the primitives: `createCookie` / `createCookieSessionStorage`, parse in loaders, `Set-Cookie` from actions — framework/data-mode APIs ([Sessions and Cookies](https://reactrouter.com/explanation/sessions-and-cookies)). The reference library is [remix-themes](https://github.com/abereghici/remix-themes) (v2+ targets React Router 7): cookie session storage, root loader returns `getTheme()`, `<html data-theme={theme}>`, a `createThemeAction` resolver route for switching, and a `PreventFlashOnWrongTheme` inline-script component for the one gap cookies can't cover — the very first visit, when no cookie exists yet and `'system'` must be resolved client-side.

### TanStack Start

- Server-known: the root route's shell/root component renders `<html>` — set the class there.
- Client-known: two documented community patterns:
  - **localStorage + `ScriptOnce`** — `ScriptOnce` from `@tanstack/react-router` renders an inline `<script>` exactly once during SSR, executing before hydration and removing itself via `document.currentScript.remove()`; this is TanStack's first-class equivalent of next-themes' `ThemeScript`. Used by the shadcn official guide ([shadcn: Dark mode — TanStack Start](https://ui.shadcn.com/docs/dark-mode/tanstack-start), merged via [shadcn-ui/ui#10396](https://github.com/shadcn-ui/ui/pull/10396); mechanism per [TanStack document-head docs](https://tanstack.com/router/v1/docs/framework/react/guide/document-head-management) and [Montini](https://leonardomontini.dev/tanstack-start-theme/), [Claudio](https://www.ramonclaudio.com/posts/tanstack-start-dark-mode)).
  - **Cookie + server function** — `createServerFn` + cookie helpers so the root route SSRs the right attribute, same trade-off as remix-themes ([dev.to: How to add theming to an SSR app (TanStack Start)](https://dev.to/ishchhabra/how-to-add-theming-to-an-ssr-app-tanstack-start-56mn)).

### Plain Vite SPA

No SSR, so "flash" only means the gap before React's first paint — and a SPA paints nothing meaningful before React anyway. Options, strongest first:
1. **Build-time**: class on `<html>` in `index.html`, using Vite's `%VITE_BRAND%` HTML env replacement — theme fixed per build, zero JS. Matches our env-var deployment model exactly.
2. **Pre-mount**: set the class on `document.documentElement` in `main.tsx` before `createRoot(...).render()`.
3. **Effect-based**: the shadcn Vite guide does localStorage + a provider effect with no inline script at all, accepting the theoretical first-frame gap ([shadcn: Dark mode — Vite](https://ui.shadcn.com/docs/dark-mode/vite)).

---

## 3. Feasibility of vendoring next-themes

**Feasible on every axis — but recommended only as a future, partial vendoring.**

- **License**: MIT, © 2022 Paco Coursey ([license.md](https://github.com/pacocoursey/next-themes/blob/main/license.md)). Vendoring requires only retaining the copyright + permission notice in the vendored file header. No copyleft, no attribution UI requirements.
- **Size**: 3 source files, ~10.9 kB TypeScript; 1.55 kB gzipped built (measured from the published `dist/index.mjs`). Negligible.
- **Portability**: zero Next imports (verified, §1) — it would run unmodified under RR7, TanStack Start, and Vite today. The proposed `@elmeragroup/ui/next/theme-provider` re-export would be *literally identical* to the core export — which is itself the strongest evidence the split-by-framework packaging adds nothing.
- **Maintenance**: the package is stable and slow-moving (v0.4.6, no dependencies, ~260 lines); tracking upstream fixes by hand is cheap. The real maintenance cost is conceptual: we'd own light/dark/system machinery (`enableSystem`, `systemTheme`, storage events, media-query listeners) that our theming model doesn't use, and every consumer would see an API surface (`setTheme`, `themes`, `resolvedTheme`) that is a lie for deployment-fixed themes.

So: *can* we vendor it? Yes, easily. *Should* we, for v1? No — see §4.

---

## 4. The wrinkle: our theme isn't a preference

| | next-themes' problem | Our problem |
|---|---|---|
| Theme decided by | User (toggle) + OS (`prefers-color-scheme`) | Deployment (env var) |
| Server knows it | Never (localStorage) | Always |
| Changes at runtime | Yes (toggle, OS switch, cross-tab) | No |
| Flash prevention needs | Blocking inline script + `suppressHydrationWarning` | Nothing — SSR/build output is already correct |
| Persistence | localStorage (or cookies in the RR7/TanStack ports) | None needed |

Both reference apps already implement the right-hand column with **zero client theme state**: brand from env var → root className, done. A provider that "manages" a constant would add script bytes, a hydration-warning suppression, and a mutable `setTheme` API — all for a value that must not change at runtime. The problems genuinely differ; next-themes is not a partial solution to ours, it's a solution to a different one.

**Where the regimes will eventually meet**: the MAP reserves a dark-mode axis on `data-theme` (contract reserved, values not specced). Dark mode *is* a user preference — when that roadmap item lands, the client-known regime applies to that one axis, and next-themes' `script.ts` (53 lines, MIT) is exactly the right thing to vendor for it: `attribute: 'data-theme'`, `enableSystem`, cookie-or-localStorage per framework recipe above. Brand/variant/segment stay server-rendered and static regardless.

---

## Recommended architecture

Ship our own micro-provider; no next-themes code in v1.

```
@elmeragroup/ui/react/theme
├── themeSlug({ variant, brand, segment }) → 'external-fkas-private'   // pure, isomorphic
├── parseThemeSlug(slug) → { variant, brand, segment }                 // pure, validates the 16 permutations
├── themeClass(slug) → 'theme-external-fkas-private'                   // the class the token CSS targets
├── <ThemeProvider theme={slug}>                                       // React context only — no effects,
│                                                                      //   no script, no DOM mutation
└── useTheme() → { slug, variant, brand, segment }                     // for logo pickers, brand-conditional UI
```

- **The provider carries data, not behavior.** Applying the class is the host app's job, in the one place each framework renders the document root. This is what makes it framework-agnostic: there is nothing to adapt.
- **Per-framework recipes** (documentation, not packages):
  - *Next*: `<html className={themeClass(slug)}>` in `app/layout.tsx`, slug from env.
  - *React Router 7*: same, in `root.tsx`'s `Layout`.
  - *TanStack Start*: same, in the root route's shell component.
  - *Vite SPA*: `%VITE_…%` replacement in `index.html`, or set on `document.documentElement` before `createRoot().render()`.
- **No `@elmeragroup/ui/next/theme-provider` re-export** — with a data-only provider there is no framework delta to paper over; a Next-specific entry point would be an empty alias that implies a difference that doesn't exist.
- **Escape hatch for per-request theming** (one host serving multiple brands): the same provider works — the host resolves the slug in its root loader/layout from hostname or cookie and passes it down. Cookie plumbing is the host's, using its framework's primitives (§2).
- **Dark-mode roadmap item**: add a separate `<ColorSchemeScript>` + `useColorScheme()` pair, vendored/adapted from next-themes' `script.ts` (MIT notice retained), targeting the reserved `data-theme` attribute; per-framework placement = next-themes provider (Next), remix-themes-style cookie (RR7), `ScriptOnce` (TanStack Start), `index.html` script (Vite). Orthogonal to, and layered on top of, the static brand theme.

## Sources

- next-themes source: [index.tsx](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/index.tsx) · [script.ts](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/script.ts) · [types.ts](https://github.com/pacocoursey/next-themes/blob/main/next-themes/src/types.ts) · [package.json](https://github.com/pacocoursey/next-themes/blob/main/next-themes/package.json) · [license.md](https://github.com/pacocoursey/next-themes/blob/main/license.md) · [README](https://github.com/pacocoursey/next-themes#readme) · dist size measured from [unpkg 0.4.6](https://unpkg.com/next-themes@0.4.6/dist/index.mjs)
- React Router 7: [Sessions and Cookies](https://reactrouter.com/explanation/sessions-and-cookies) · [remix-themes (v2 = RR7)](https://github.com/abereghici/remix-themes)
- TanStack: [Document head management / ScriptOnce](https://tanstack.com/router/v1/docs/framework/react/guide/document-head-management) · [shadcn dark-mode guide for TanStack Start](https://ui.shadcn.com/docs/dark-mode/tanstack-start) · [shadcn-ui/ui#10396](https://github.com/shadcn-ui/ui/pull/10396) · [Montini: TanStack Start themes without flickers](https://leonardomontini.dev/tanstack-start-theme/) · [Claudio: Dark Mode in TanStack Start](https://www.ramonclaudio.com/posts/tanstack-start-dark-mode) · [Chhabra: theming an SSR app (cookie pattern)](https://dev.to/ishchhabra/how-to-add-theming-to-an-ssr-app-tanstack-start-56mn)
- Vite SPA: [shadcn dark-mode guide for Vite](https://ui.shadcn.com/docs/dark-mode/vite)
- Local: both reference apps set brand via env var into root className server-side, zero client theme state (reference-app exploration, ticket 005 body); dark-mode `data-theme` axis reservation ([MAP.md](../MAP.md) scope rules).
