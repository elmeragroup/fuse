---
id: 006
title: Theme provider API
type: grilling
status: open
assignee: null
blocked-by: [002, 005]
---

## Question

What is the exact public API of the theme provider(s)?

Decide, given the cascade mechanism (*Theming cascade prototype*) and the SSR research (*Theme provider & SSR research*):

1. Input shape: full slug (`internal-fkas-company`) and/or decomposed props (`variant` + `brand` + `segment`) — the brief allows either; pick one primary with the other derived, and define validation (pinned-brand rules).
2. Export layout: `@elmeragroup/ui/react/theme-provider` (core) and `@elmeragroup/ui/next/theme-provider` (Next re-export of vendored next-themes or of the core) — confirm and spec both signatures.
3. SSR story per framework: how a server-known theme reaches the root element with zero flash in Next, React Router 7, TanStack Start, Vite SPA; document the recipe per framework.
4. Scoped theming: can a subtree carry a different theme (OrderModuleWeb re-brands a `<main>` per track and portals overlays inside it) — provider nesting semantics and portal guidance.
5. Runtime theme switching (needed at least for docs/playground and Storybook-style brand pickers): supported in v1? API?
6. Future `data-theme` light/dark axis: how the API reserves it without implementing it.
