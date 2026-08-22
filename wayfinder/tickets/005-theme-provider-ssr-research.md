---
id: 005
title: Theme provider & SSR research
type: research
status: closed
assignee: research-agent
blocked-by: []
---

## Question

How should a framework-agnostic theme provider work across Next.js, Vite SPA, React Router 7 (framework mode), and TanStack Start — with and without SSR?

Research (primary sources: next-themes source at github.com/pacocoursey/next-themes, framework docs):

1. How next-themes actually works: the inline no-flash script, attribute/class application, storage, system preference, hydration strategy — and how much of it is Next-specific vs plain React (it largely isn't Next-specific; verify).
2. What SSR-safe theme application looks like in React Router 7 and TanStack Start (root route, cookies vs localStorage, no-flash patterns) and plain Vite SPA.
3. Whether vendoring next-themes into a core provider (`@elmeragroup/ui/react/theme-provider`) with a thin Next re-export (`@elmeragroup/ui/next/theme-provider`) is feasible — license (MIT?), size, maintenance implications.
4. The wrinkle that our "theme" is variant×brand×segment (usually fixed per deployment, server-known, not user-toggled) while next-themes solves user-toggled light/dark — note where the problems differ. Both refs currently do zero client theme state: brand is an env var rendered into the root className server-side.

Deliverable: `wayfinder/research/005-theme-provider-ssr.md`.

## Resolution

Findings: [research/005-theme-provider-ssr.md](../research/005-theme-provider-ssr.md).

1. next-themes (v0.4.6, MIT, 1.55 kB gz, zero deps) has **zero Next.js imports** — it's pure React; its trick is a blocking inline script applying the theme pre-paint from localStorage/system preference, with `useTheme` undefined during SSR.
2. Per-framework SSR recipes documented: React Router 7 = cookie in root loader → server-rendered attribute; TanStack Start = `ScriptOnce` or server-fn cookie; Vite SPA = build-time class in index.html.
3. Vendoring is technically trivial — but a `/next/theme-provider` re-export would be byte-identical to the core, adding nothing.
4. **Decisive mismatch**: next-themes solves _client-known user preference_; our theme is _server-known and deployment-fixed_ (both refs render brand class server-side from env). **Recommendation: don't vendor next-themes for v1.** Ship a data-only micro-provider (pure `themeSlug`/`themeClass` helpers + context + `useTheme`), host apps render the attribute/class at their document root via one-line per-framework recipes; vendor next-themes' 53-line script later only for the roadmap dark-mode toggle on the reserved `data-theme` axis.

This challenges the brief's "re-export next-themes" instruction with evidence — final call lands in _Theme provider API_ (now unblocked on this side; still waits on _Theming cascade prototype_).
