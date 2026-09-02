# 0005 — Single-package architecture with kumo-style tsdown builds and dual CSS

Date: 2026-08-17. Status: accepted; amended 2026-08-18 to preserve source-level RSC boundaries; amended 2026-09-02 — chart deferred (Wave 9), recharts not a published peer.

## Context

Both reference monorepos ship raw TSX consumed via `transpilePackages` — a shape that cannot survive public npm. The library publishes publicly under `@elmeragroup/ui` (MIT, everything-public per the licensing decision). References examined: kumo (tsdown two-pass, dual CSS distribution, exports codegen) and base-ui (`publishConfig.directory`, unbundled babel+tsc). The repo's fixed toolchain already standardizes tsdown with an ESM-only template.

## Decision

- **One public package**: `@elmeragroup/ui` with subpath exports (`/theme`, `/icons`, `/illustrations`, per-component paths, CSS entries). Tooling lives in separate `tooling/*` packages. No `/tokens` or `/icons` sibling packages.
- **Build**: tsdown/rolldown, unbundled ESM-only — one JS+d.ts pass preserves a one-source/one-output module graph and each source module's own `'use client'` directive; npm dependencies remain external. `publint` + `arethetypeswrong` gate CI; the exports map is code-generated with a test asserting every subpath resolves.
- **Exports**: per-component subpaths plus a root barrel scoped to the 55 shipped bare components + `/theme`; `chart` is deferred (Wave 9); the 11 interim `react-aria/*` entries, icons, and illustrations remain subpath-only; `sideEffects: false` except `*.css`.
- **CSS**: dual distribution — raw Tailwind v4 source (consumer adds one `@source` line so utilities survive node_modules non-scanning) and a precompiled standalone bundle for non-Tailwind apps; theme CSS is its own entry in both.
- **Workspace consumers**: `publishConfig.directory` — src exports in-repo, dist when published; CI tests the published shape.
- **Dependencies**: react/react-dom peers `^19`; base-ui, react-aria-components, Phosphor pinned regular; recharts is a future optional peer when chart ships.

## Alternatives rejected

- **Package family** (`/ui` + `/tokens` + `/icons`) — cross-package version skew and peer-range bookkeeping with no consumer benefit at this scale.
- **base-ui's unbundled babel+tsc** — the module-preserving shape is adopted, but its second build toolchain is not; tsdown supplies the same boundary under the repo standard.
- **Per-entry tsdown bundles with injected banners** — a mixed entry such as `/theme` contains both server-safe helpers and client providers, so an entry-wide banner collapses a boundary the source graph intentionally preserves.
- **Subpaths-only (no barrel)** — owner preferred barrel DX; scoping the barrel to components+theme keeps the tree-shaking risk contained.
- **Compiled-classes-only CSS** — loses consumer-side Tailwind dedup/customization; **source-only** — abandons non-Tailwind apps.
- **base-ui as peer** — exposes an implementation detail as consumer bookkeeping.

## Consequences

- ESM-only publishing (no CJS entry) — also neutralizes Phosphor's 5 MB CJS monolith trap.
- Source-level React Server Component boundaries survive publication; directive parity is tested against the packed artifact.
- Adding a component = adding a source file; the exports map and its test regenerate.
- Non-Tailwind consumers are first-class via the standalone CSS bundle.
- The public/private name-collision check against the internal `@elmeragroup/*` scope belongs to the release pipeline.

## Amendment 2026-09-02 — chart deferred, recharts not a published peer

`chart` is Wave 9 ([roadmap](../spec/roadmap.md) §11). The barrel is 55 shipped bare components + `/theme`. `recharts` is a future optional peer, not a published range, until chart ships.

## Amendment 2026-09-02 — standalone CSS compiles from dist only

The build-only wrapper that produces `styles.css` imports `tailwindcss/utilities.css` with `source(none)` and names the emitted dist JavaScript as its single `@source`. Automatic source detection is off: with it on, Tailwind also scanned the working tree, so a utility spelled only in a test or another unpublished module was compiled into the published sheet. The wrapper therefore carries no `@source not` exclusions — nothing under `src/` is scanned, so nothing under `src/` has to be excluded — and the sheet is a description of the published JavaScript. Dual distribution itself is unchanged: raw-source consumers still point one `@source` at the installed package.
