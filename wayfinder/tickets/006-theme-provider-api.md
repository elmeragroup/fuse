---
id: 006
title: Theme provider API
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [002, 005]
---

## Question

What is the exact public API of the theme provider(s)?

Decide, given the cascade mechanism (_Theming cascade prototype_) and the SSR research (_Theme provider & SSR research_):

1. Input shape: full slug (`internal-fkas-company`) and/or decomposed props (`variant` + `brand` + `segment`) — the brief allows either; pick one primary with the other derived, and define validation (pinned-brand rules).
2. Export layout: `@elmeragroup/ui/react/theme-provider` (core) and `@elmeragroup/ui/next/theme-provider` (Next re-export of vendored next-themes or of the core) — confirm and spec both signatures.
3. SSR story per framework: how a server-known theme reaches the root element with zero flash in Next, React Router 7, TanStack Start, Vite SPA; document the recipe per framework.
4. Scoped theming: can a subtree carry a different theme (OrderModuleWeb re-brands a `<main>` per track and portals overlays inside it) — provider nesting semantics and portal guidance.
5. Runtime theme switching (needed at least for docs/playground and Storybook-style brand pickers): supported in v1? API?
6. Future `data-theme` light/dark axis: how the API reserves it without implementing it.

Handed over from [Theming cascade prototype](002-theming-cascade-prototype.md)'s resolution: the mechanism is three data attributes on any element; markers re-theme subtrees natively, but a portal rendered _outside_ a scoped subtree silently takes the outer theme — the provider API owns portal-inside discipline (point 4) and pinned-brand validation (fkab→company, fkse→private; CSS cannot forbid illegal combos — point 1).

## Resolution

Decided 2026-08-17 via grilling, user-confirmed. Rationale for the central call in [ADR 0003](../../docs/adr/0003-data-only-theme-provider.md); SSR groundwork in [research 005](../research/005-theme-provider-ssr.md).

**Single entry `@elmeragroup/ui/theme`** (no per-framework entry points — a Next-specific export would be an identical alias). Data-only: no effects, no inline script for the brand theme, no DOM mutation, no hydration suppression — the theme is server-known, so zero flash by construction. next-themes is **not vendored**.

1. **Input shape**: decomposed object primary — `<ThemeProvider theme={{ variant, brand, segment }}>`; slug always derivable (`themeSlug`/`parseThemeSlug` exported, pure, isomorphic).
2. **Provider**: fully controlled context carrier. No `setTheme` — switching is host-owned state (docs/Storybook pickers re-render the provider). `useTheme()` → `{ variant, brand, segment, slug }`.
3. **`themeAttributes(theme)`** → the three `data-theme-*` attributes; the **headline recipe** is spreading it on `<html>` in the framework's root layout, slug/axes from env. Four documented recipes: Next App Router, React Router 7 (`root.tsx` Layout), TanStack Start (root route shell), Vite SPA (`%VITE_*%` in index.html or pre-mount).
4. **`ThemeScope`** — escape hatch for per-request/multi-theme subtrees (the sms-accept per-customer pattern; the docs playground's 16-permutation grid): one component fusing the data attributes and a nested context so CSS and `useTheme()` cannot drift. Polymorphism via base-ui **`useRender`** (`render` prop + `mergeProps`, default tag `div`) — **standing convention: all library polymorphism uses `useRender`, never an `as` prop** (added to map Notes; feeds [Component API spec template](011-component-api-spec-template.md)). Overlay components take a `container` prop; docs mandate portalling inside the scope.
5. **Types**: discriminated `ThemeInput` union makes `fkab-private`/`fkse-company` unrepresentable at compile time; `validateTheme` covers untyped inputs — throw in dev, coerce-to-pinned-segment + console warning in prod (per [Brand–segment matrix gaps](004-brand-segment-matrix-gaps.md)).
6. **`BRANDS`** record — `{ code, displayName, segments }` per brand (fkse → `displayName: "Telinet"`); logo components live with the icon system, keyed by the same codes.
7. **Dark axis: fully wired except CSS values** (user direction). `<ColorSchemeScript>` + `useColorScheme()` ship _functional_ in v1 — adapted from next-themes' `script.ts` (53 lines, MIT notice retained), reading preference and setting the reserved `data-theme` attribute before first paint. The theme CSS ships a ready-to-go **empty dark section** (`[data-theme="dark"]`-guarded block containing only a comment: values land with the dark-mode roadmap item) — requirement handed to [Token pipeline](018-token-pipeline.md). `ThemeInput` gets no dark field; color scheme stays an orthogonal, layered axis.
