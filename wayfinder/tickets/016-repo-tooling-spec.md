---
id: 016
title: Repo & tooling spec
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [008, 015]
---

## Question

What is the exact monorepo scaffold: workspace layout, turbo task graph, and shared tooling?

Fixed: pnpm + turborepo + oxlint + oxfmt + anti-slop + vitest. Decide the rest, mining the refs:

1. Workspace shape: `packages/*` + `apps/*` (docs app) + `tooling/*` (typescript-config, oxlint plugin) — mirroring the internal ref, which is the stated copy-paste baseline.
2. pnpm catalog for version pinning; supply-chain settings both refs use (`minimumReleaseAge: 4320`, overrides).
3. Turbo task graph (build/lint/type-check/test/test:browser/dev/ci:checks) with env allowlists and outputs.
4. oxfmt config incl. `sortTailwindcss.stylesheet` pointed at the library's ui.css and `functions: ["tv","cn"]`; oxlint type-aware config; **custom design-system lint rules** as whitelabel guardrails (kumo's `no-primitive-colors`, `no-tailwind-dark-variant`, `enforce-variant-standard` pattern + the existing `@elmeragroup/oxlint-plugin` rules) — which rules ship v1.
5. anti-slop wiring per its research findings.
6. Component scaffolding automation (kumo's plop generator with inject markers) — in v1 spec or roadmap?
7. TypeScript config strategy (internal ref's `tooling/typescript` base/react-library/internal-package split), Node version pin.

## Resolution

Decided 2026-08-17 via grilling — all branches on the internal-ref/kumo baseline.

1. **Workspace**: `packages/ui` + `apps/docs` (Next custom-MDX) + `apps/playground` + `tooling/typescript`, `tooling/oxlint-plugin`, `tooling/oxlint-anti-slop` (vendored per [anti-slop research](015-anti-slop-research.md)). pnpm workspaces + turborepo.
2. **Hygiene baseline adopted**: pnpm catalog for version pinning; `minimumReleaseAge: 4320` + overrides block; turbo graph = build / lint / type-check / test / test:browser / dev / `ci:checks` aggregate with env allowlists and declared outputs; Node pinned to current LTS (engines + `.node-version`); TS configs split base / react-library / internal-package.
3. **Lint**: oxlint type-aware, three plugins — the internal `@elmeragroup/oxlint-plugin` rules, **anti-slop**, and the **kumo-pattern whitelabel guardrails all in v1**: `no-primitive-colors` (library source styles with role tokens only), `no-tailwind-dark-variant` (`dark:` forbidden — the axis is token-reserved), `enforce-variant-standard` (tv structure conformance). oxfmt with `sortTailwindcss.stylesheet` pointed at the library's ui.css and `functions: ["tv","cn"]`.
4. **Scaffolding: plop generator in v1** — one command stubs component + co-located tests + demo + docs page + exports-map entry via inject markers, mechanically enforcing the [ten-section template](011-component-api-spec-template.md)'s file conventions.

Seeds the tooling chapter of `docs/spec/` at assembly.
