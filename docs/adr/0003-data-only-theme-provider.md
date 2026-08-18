# 0003 — Data-only theme provider; next-themes not vendored

Date: 2026-08-17. Status: accepted.

## Context

Themes (variant × brand × segment) are **server-known and deployment-fixed** — both reference apps set the brand from an env var into the root element server-side with zero client theme state. next-themes was evaluated for vendoring (research 005): it is framework-agnostic, MIT, 1.55 kB — but it exists to solve the opposite problem: applying a theme the server *cannot* know (localStorage + `prefers-color-scheme`) via a blocking inline script and `suppressHydrationWarning`. The one axis where that problem is real — light/dark — is reserved on `data-theme` but has no specced values yet.

## Decision

`@elmeragroup/ui/theme` ships a **data-only provider**: React context + pure helpers (`themeSlug`, `parseThemeSlug`, `themeAttributes`), no effects, no script, no DOM mutation for the brand theme. The host spreads `themeAttributes(theme)` onto `<html>` in its root layout — zero flash by construction. The provider is fully controlled; no `setTheme` (switching is host state). `ThemeScope` (polymorphic via base-ui `useRender`) covers per-request subtree theming and multi-theme pages. A discriminated `ThemeInput` union makes pinned-brand violations unrepresentable; runtime validation dev-throws / prod-coerces for untyped inputs. One entry point — no per-framework re-exports; framework integration is four documentation recipes.

The dark axis ships **wired but valueless**: `<ColorSchemeScript>` + `useColorScheme()` are functional in v1 (adapted from next-themes' `script.ts`, MIT notice retained), setting the reserved `data-theme` before first paint; theme CSS carries a terminal comment reserving the future `[data-theme="dark"]` block (not an empty CSS rule node) until dark values are specced.

## Alternatives rejected

- **Vendor next-themes for the brand theme** — machinery for a client-known preference applied to a deployment-fixed constant: adds script bytes, hydration suppression, and a mutable API that must not be used.
- **Provider that mutates `document.documentElement` in an effect** — client JS + SSR-mismatch handling for a value that never changes.
- **Per-framework entry points** (`/next/theme-provider` …) — verified to be byte-identical aliases; they imply a difference that doesn't exist.
- **Library-owned `setTheme` state** — every app would carry switching machinery needed only by docs/Storybook pickers, which host state serves fine.

## Consequences

- Framework support is documentation, not code — Next, React Router 7, TanStack Start, and Vite recipes all reduce to "spread the attributes on your root element".
- Apps ship no theme JS at all beyond context; the only inline script in the system is the color-scheme one, which earns it (genuinely client-known).
- When dark values land, nothing about the brand-theme API changes — `data-theme` is already being set by the shipped script.
- The `useRender` polymorphism convention set here binds all future library components (no `as` props).
