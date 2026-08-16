---
id: 008
title: Package architecture & build pipeline
type: grilling
status: open
assignee: null
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
