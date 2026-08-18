# 0005 — Single-package architecture with kumo-style tsdown builds and dual CSS

Date: 2026-08-17. Status: accepted.

## Context

Both reference monorepos ship raw TSX consumed via `transpilePackages` — a shape that cannot survive public npm. The library publishes publicly under `@elmeragroup/ui` (MIT, everything-public per the licensing decision). References examined: kumo (tsdown two-pass, dual CSS distribution, exports codegen) and base-ui (`publishConfig.directory`, unbundled babel+tsc). The repo's fixed toolchain already standardizes tsdown with an ESM-only template.

## Decision

- **One public package**: `@elmeragroup/ui` with subpath exports (`/theme`, `/icons`, `/illustrations`, per-component paths, CSS entries). Tooling lives in separate `tooling/*` packages. No `/tokens` or `/icons` sibling packages.
- **Build**: kumo's tsdown/rolldown two-pass, ESM-only — JS pass bundles internal deps, d.ts pass externalizes; `'use client'` banners re-injected on client entries; `publint` + `arethetypeswrong` gate CI; the exports map is code-generated with a test asserting every subpath resolves.
- **Exports**: per-component subpaths plus a root barrel scoped to components + `/theme` (icons/illustrations subpath-only); `sideEffects: false` except `*.css`.
- **CSS**: dual distribution — raw Tailwind v4 source (consumer adds one `@source` line so utilities survive node_modules non-scanning) and a precompiled standalone bundle for non-Tailwind apps; theme CSS is its own entry in both.
- **Workspace consumers**: `publishConfig.directory` — src exports in-repo, dist when published; CI tests the published shape.
- **Dependencies**: react/react-dom peers `^19`; base-ui, react-aria-components, Phosphor pinned regular; recharts optional peer.

## Alternatives rejected

- **Package family** (`/ui` + `/tokens` + `/icons`) — cross-package version skew and peer-range bookkeeping with no consumer benefit at this scale.
- **base-ui's unbundled babel+tsc** — a second build toolchain diverging from the repo's tsdown standard.
- **Subpaths-only (no barrel)** — owner preferred barrel DX; scoping the barrel to components+theme keeps the tree-shaking risk contained.
- **Compiled-classes-only CSS** — loses consumer-side Tailwind dedup/customization; **source-only** — abandons non-Tailwind apps.
- **base-ui as peer** — exposes an implementation detail as consumer bookkeeping.

## Consequences

- ESM-only publishing (no CJS entry) — also neutralizes Phosphor's 5 MB CJS monolith trap.
- Adding a component = adding a source file; the exports map and its test regenerate.
- Non-Tailwind consumers are first-class via the standalone CSS bundle.
- The public/private name-collision check against the internal `@elmeragroup/*` scope belongs to the release pipeline.
