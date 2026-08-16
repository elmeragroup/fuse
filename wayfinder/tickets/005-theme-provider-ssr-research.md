---
id: 005
title: Theme provider & SSR research
type: research
status: open
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
