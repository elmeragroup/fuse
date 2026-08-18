# @elmeragroup/ui — implementation specification

The implementation-ready architecture and product specification for `@elmeragroup/ui`: the whitelabel React component library serving Elmera Group's five consumer energy brands across **16 theme permutations** (variant × brand × segment). This document set is the deliverable of the wayfinder specification effort; an implementing agent builds the library from these documents alone, without returning to the effort's tickets.

## What is being built

A single public npm package, `@elmeragroup/ui`, that renders the same component tree as any of 16 themes — `internal`/`external` × Fjordkraft (`fkas`) / Trøndelagkraft (`tkas`) / Gudbrandsdal Energi (`guen`) / Fjordkraft Företag (`fkab`, permanent fkas alias) / Telinet (`fkse`) × `private`/`company` — selected by three data attributes, with no rebuild and no fork. **~75 canonical components in four tiers**: base-ui (the default), react-aria interim (date cluster, quarantined behind `react-aria/` paths, marked for migration), composites, and unheadless primitives. Vocabulary: [CONTEXT.md](../../CONTEXT.md) is the glossary and its terms are used verbatim throughout.

## Fixed constraints

React 19 · base-ui primitives · Tailwind v4 · tv (tailwind-variants) · Phosphor icons · pnpm + turborepo · oxlint + oxfmt + anti-slop · vitest (unit + browser mode) · tsdown ESM-only build · published public on npmjs.com under `@elmeragroup/ui` · MIT · light themes only at v1 (dark axis reserved in the contract).

## The document set

| Document | Owns |
| --- | --- |
| [architecture.md](architecture.md) | Package structure, entries/exports, tsdown build, JS + CSS distribution, dependency policy |
| [theming.md](theming.md) | Token contract, cascade mechanism, the full 16-permutation value matrix, theme provider API, token pipeline |
| [components/](components/) | Per-component API specs (66 files) — start at [conventions.md](components/conventions.md), the shared-conventions chapter every spec references |
| [accessibility.md](accessibility.md) | WCAG 2.2 AA target, focus/keyboard/labeling rules, i18n string architecture, contrast policy, motion |
| [performance.md](performance.md) | Bundle budgets, RSC/client-boundary policy, CSS budgets, lazy-loading stance, runtime practices |
| [tooling.md](tooling.md) | Repo workspace, lint/format guardrails, scaffolding, full testing strategy, merge gate |
| [docs-site.md](docs-site.md) | Docs site (design + pipeline), playground, API-reference generation, llms.txt |
| [release.md](release.md) | Changesets flow, channels, npm Trusted Publishing, org-setup prerequisites |
| [roadmap.md](roadmap.md) | Deferred work with triggers: react-aria→base-ui migration, dark mode, VR, new brands/locales |

Hard-to-reverse trade-offs are recorded as ADRs in [../adr/](../adr/) (0001 token contract · 0002 theme attributes · 0003 data-only provider · 0004 Phosphor · 0005 package architecture · 0006 intl strings). The spec documents are normative; ADRs carry the why.

## How to implement from this spec

1. **Read order**: this README → [conventions.md](components/conventions.md) → [architecture.md](architecture.md) → [theming.md](theming.md); the rest as their subjects come up.
2. **Sequencing constraints** the spec imposes:
   - Repo scaffold and token pipeline first ([tooling.md](tooling.md), [theming.md](theming.md)) — every component consumes the generated `themes.css` and the lint guardrails.
   - Component build order is free within tiers; each component ships with its spec's §9 tests and §10 demos in the same change.
   - The docs site is **not built until the dogfood gate passes**: an in-repo prototype consuming the real library (Button + one complex component) per [docs-site.md](docs-site.md).
   - Publishing waits on the org-setup prerequisites in [release.md](release.md) (tracked as an open task; blocks release, not development).
3. **Divergence discipline**: reference behavior is spec'd verbatim per component; every deliberate difference from the reference codebases is a §8 Divergence entry in that component's spec. If implementation uncovers a contradiction between documents, the more specific document wins and the contradiction is fixed in the spec, not silently resolved in code.

## Out of scope (ruled, not deferred)

Migration plans for the two existing OrderModule apps — ruled out of the effort entirely; the spec carries no compat assessment. Everything else deferred lives in [roadmap.md](roadmap.md) with its trigger.
