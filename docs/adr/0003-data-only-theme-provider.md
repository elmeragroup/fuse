# 0003 — Controlled brand theme; hosts own first-paint HTML; next-themes not vendored

Date: 2026-08-17. Status: accepted.
Amended: 2026-08-19 — DOM policy only. Brand remains a controlled host value with no persistence and no library `setTheme`. Hosts own initial brand HTML; `ThemeProvider` owns runtime echo; a host-placed closed script owns client-known pre-paint color scheme.

## Context

Themes (variant × brand × segment) are **server-known and deployment-fixed** — both reference apps set the brand from an env var into the root element server-side with zero client brand state. next-themes was evaluated for vendoring (research 005): it is framework-agnostic, MIT, 1.55 kB — but it exists to solve the opposite problem: applying a theme the server *cannot* know (localStorage + `prefers-color-scheme`) via a blocking inline script and `suppressHydrationWarning`. The one axis where that problem is real — light/dark — is reserved on `data-theme` and ships a functional marker in v1, with no specced dark token values yet.

The original call treated the provider as data-only (context + helpers, no DOM writes). That remains the right **source-of-truth** decision for brand. It is the wrong **universal first-paint** decision: `_app` cannot stamp `<html>`, Vite `createRoot` `<script>` nodes do not execute, and treating one React provider as a portable no-flash path is false.

## Decision

`@elmeragroup/ui/theme` ships one kernel (validate, map, resolve, serialize) and **separate first-paint adapters**. There is one public entry — no `/theme/next`, `/theme/vite`, or other per-framework re-exports. Framework integration is documented recipes ([theming](../spec/theming.md) §7.3). next-themes is **not vendored**; MIT-notice text is retained where ideas or source text are copied.

**Brand (controlled, unchanged from the original call):**

- Fully controlled `theme: ThemeInput`. No library `setTheme` for variant/brand/segment.
- Brand is never stored in `localStorage` or cookies.
- Pure helpers (`themeSlug`, `parseThemeSlug`, `themeAttributes`, `coerceTheme`, `validateTheme`) stay the mapper and boundary. Unknown/missing axes throw everywhere from `validateTheme`; pinned-segment mistakes throw in development and coerce + warn in production. `coerceTheme` is the env-free pin-table parse used by host pickers that need silent pinning.
- `ThemeScope` (polymorphic via base-ui `useRender`) covers per-request subtree theming and multi-theme pages. It writes its own element via `themeAttributes` and never owns `document.documentElement`.
- A discriminated `ThemeInput` union makes pinned-brand violations unrepresentable.

**DOM policy (amended):**

- **Hosts own initial brand HTML.** Spread `themeAttributes(theme)` onto `<html>` in SSR or at build time. JavaScript-disabled pages still show the correct brand.
- **`ThemeProvider` owns runtime echo** of that same validated `theme` (insertion/layout phase), plus the color-scheme state machine after paint. Nested providers passthrough only when an outer document writer exists; `ThemeScope` does not set that flag.
- **A host-placed closed script owns client-known pre-paint color scheme.** `colorSchemeScriptSource` / `ColorSchemeScript` run before paintable content. `injectColorSchemeScript` defaults **false**. The provider is not the universal first-paint writer.
- Callers pass **one** brand configuration to HTML and provider, and **matching** color-scheme literals to bootstrap and provider.

The dark axis ships **wired but valueless**: the closed bootstrap sets reserved `data-theme` to `"light"` or `"dark"` before paint; `useColorScheme()` and `<ForceColorScheme>` are functional at runtime; theme CSS carries a terminal comment reserving the future `[data-theme="dark"]` block (not an empty CSS rule node) until dark values are specced. This wave does not write `style.colorScheme` or a color-scheme meta tag. Descendant `ForceColorScheme` is runtime-only; no-flash force requires a document adapter.

## Alternatives rejected

- **Vendor next-themes for the brand theme** — machinery for a client-known preference applied to a deployment-fixed constant: adds script bytes, hydration suppression, and a mutable API that must not be used.
- **Provider as the universal first-paint adapter** — incomplete on Next Pages, false on Vite (`createRoot` scripts do not run), and conflates runtime echo with parser-time HTML.
- **Provider that mutates `document.documentElement` in a passive effect as first paint** — too late; first paint is host HTML plus a classic blocking script.
- **Per-framework entry points** (`/next/theme-provider` …) — verified to be byte-identical aliases; they imply a difference that doesn't exist. Recipes differ; the module does not.
- **Library-owned `setTheme` state for brand** — every app would carry switching machinery needed only by preview UIs. Docs preview is `ThemeScope` state, not a document-provider rewrite.
- **`enableColorScheme` / `<meta name="color-scheme">` before dark tokens** — a dark-OS visitor would get a black UA canvas and inverted native controls against light tokens.
- **Copied generated bootstrap artifacts or app-graph apply imports** — Vite and TanStack need closed IIFE **text** produced at config/document time from `colorSchemeScriptSource`.

## Consequences

- Framework support is documentation, not code entries — Next App Router, Next Pages, TanStack Start, React Router 7, and Vite each place brand attributes and the classic bootstrap in a host-owned location. Next App Router and Vite are fixture-verified; the other three are written recipes, not verified no-flash claims.
- Apps still ship no brand persistence. The only inline script in the system is the color-scheme one, which earns it (genuinely client-known). Hosts, not the provider, place it.
- When dark values land, nothing about the brand-theme API changes — `data-theme` is already being set by the shipped script. `style.colorScheme` is revisited then.
- The `useRender` polymorphism convention set here binds all future library components (no `as` props).
