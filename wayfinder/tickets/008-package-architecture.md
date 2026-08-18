---
id: 008
title: Package architecture & build pipeline
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [010]
---

## Question

What is the package layout, build pipeline, and distribution shape of a **publicly published** `@elmeragroup/ui`?

Both refs ship raw TSX via `transpilePackages` — that does not survive public npm. Decide:

1. Package boundaries: single `@elmeragroup/ui` vs a family (`/ui`, `/tokens` or theme CSS, `/icons`, `/fonts`(licensing-dependent), tooling configs). Namespace collision note: both ref monorepos already use `@elmeragroup/*` internally for private packages.
2. Build: kumo's tsdown/rolldown two-pass pattern (JS bundles deps, d.ts externalizes; `"use client"` re-injected via banner; publint + attw gates; generated exports map + export-path test) vs base-ui's unbundled babel+tsc — pick and spec.
3. Exports strategy: per-component subpaths (both refs and all references do this) + barrel or no barrel; CSS entry points.
4. CSS distribution: kumo's dual mode — raw Tailwind v4 source (`@import "@elmeragroup/ui/ui.css"`) for Tailwind consumers *and* a compiled standalone bundle for non-Tailwind apps; `@source` scanning strategy for published packages (published code isn't scanned by consumer Tailwind — how do utility classes survive? safelist vs shipping compiled classes vs requiring `@source` into node_modules).
5. Workspace-consumer story: base-ui's `publishConfig.directory` pattern (source exports in-repo, built exports when published)?
6. Peer deps policy (react range, optional peers for recharts/date libs), sideEffects, tree-shaking.

Deliverable: the locked architecture recorded here; it seeds `docs/spec/architecture.md` at assembly.

## Resolution

Decided 2026-08-17 via grilling. Rationale for the hard-to-reverse calls in [ADR 0005](../../docs/adr/0005-package-architecture.md).

1. **Single public package `@elmeragroup/ui`.** `/theme`, `/icons`, `/illustrations`, per-component subpaths, and the CSS entries are all exports of it; one version, no cross-package skew. Tooling (oxlint plugins incl. `tooling/oxlint-anti-slop`, shared configs) stays in separate `tooling/*` packages. Public names must not collide with the internally-used private `@elmeragroup/*` scope — checked at the release-pipeline stage ([Release & versioning pipeline](014-release-pipeline.md)).
2. **Build = kumo tsdown two-pass**, ESM-only (the repo's tsdown template): JS pass bundles internal deps, d.ts pass externalizes; `'use client'` re-injected via banner on client entries (also covers the Phosphor re-export banner from [Icon system](009-icon-system.md)); **publint + arethetypeswrong as CI gates**; codegen'd exports map with an export-path test asserting every subpath resolves. ESM-only also sidesteps Phosphor's CJS monolith.
3. **Exports: per-component subpaths + a root barrel** (user call over subpaths-only). Barrel scope: **components + `/theme` API only** — icons/illustrations stay subpath-only so per-icon tree-shaking stays clean. `sideEffects: false` (except `*.css`) lets bundlers shake the barrel. Bare component paths point at the winning base-ui tier; react-aria interim atoms are quarantined under an explicit prefix (path detail finalized in [Component API spec template](011-component-api-spec-template.md)).
4. **CSS: kumo dual distribution.** (a) Raw Tailwind v4 source entry — consumers `@import "@elmeragroup/ui/css"` plus one documented `@source` line pointing at the package in node_modules so consumer Tailwind generates the utility classes; (b) a precompiled standalone bundle for non-Tailwind apps. Theme CSS (16 permutations + the empty `[data-theme="dark"]` section) ships as its own entry in both modes — generation mechanics belong to [Token pipeline](018-token-pipeline.md).
5. **Workspace consumers: base-ui's `publishConfig.directory` pattern** — in-repo exports point at `src` (instant HMR for docs/playground), published exports swap to `dist`; the export-path test runs against the **published** shape in CI.
6. **Dependencies**: `react`/`react-dom` peers (`^19`); `@base-ui/react` and `react-aria-components` (interim tier) as pinned regular dependencies; `@phosphor-icons/react` pinned regular (per Icon system); `recharts` an **optional peer** (only chart consumers install it).
