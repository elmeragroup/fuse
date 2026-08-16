---
id: 016
title: Repo & tooling spec
type: grilling
status: open
assignee: null
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
