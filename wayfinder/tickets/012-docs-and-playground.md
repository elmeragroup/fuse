---
id: 012
title: Docs site & playground
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

What is the documentation and playground stack, and the demo-authoring pipeline? Quality and aesthetics explicitly outrank automation.

Reference patterns to weigh: **coss** (Next + fumadocs + shadcn registry as second distribution channel), **kumo** (Astro + MDX, demos as plain React files AST-extracted into docs + AI component registry + visual-regression targets — one authored demo feeds four outputs), **base-ui** (Next + MDX, per-demo parallel styling variants, CodeSandbox export, two playgrounds, llms.txt).

Decide: docs framework, demo authoring format, theme/brand switcher in docs (all 16 permutations viewable — this is the whitelabel sales pitch), playground approach (in-docs vs standalone), API-reference generation (automated from types vs hand-written), whether to also publish a shadcn-style registry, hosting target, and an `llms.txt`/AI-registry story.

## Resolution

Decided 2026-08-17 via grilling. Aesthetics-outrank-automation governed the framework call.

1. **Framework: Next + custom MDX pipeline** (the base-ui route, user call over my fumadocs recommendation) — total design freedom, team's Next expertise applies, highest build cost accepted deliberately. The visual design itself is a separate prototype: [Docs site design prototype](025-docs-design-prototype.md) (graduated from fog).
2. **Demos: plain runnable `.tsx` files, multi-output** (kumo pattern) — one authored demo file is AST-extracted into docs (source + live render), and the same file feeds visual-regression targets and the AI registry. Demos consume the library via workspace source exports (`publishConfig.directory`).
3. **Theme switching: global docs-wide picker + a 16-permutation matrix page.** The picker is host-owned state re-rendering the ThemeProvider (per the provider decision); the matrix page renders key components in all 16 themes side-by-side via `ThemeScope` — the whitelabel pitch page.
4. **Playground: standalone workspace app** consuming source exports (instant HMR); no in-browser editor in v1.
5. **API reference: generated from TS types** at docs build, descriptions as JSDoc on props (code = single source once it exists; the spec's hand-written tables are the authoring input until then).
6. **No shadcn-style registry in v1** — packaged dependency, not copy-paste source; noted for the roadmap document if demand appears.
7. **Hosting: Vercel** — first-class Next hosting, per-PR preview deploys.
8. **AI docs: `llms.txt` + a markdown endpoint per component** (API + demo source), generated from the same spec/demo sources at docs build.
