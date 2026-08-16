---
id: 012
title: Docs site & playground
type: grilling
status: open
assignee: null
blocked-by: []
---

## Question

What is the documentation and playground stack, and the demo-authoring pipeline? Quality and aesthetics explicitly outrank automation.

Reference patterns to weigh: **coss** (Next + fumadocs + shadcn registry as second distribution channel), **kumo** (Astro + MDX, demos as plain React files AST-extracted into docs + AI component registry + visual-regression targets — one authored demo feeds four outputs), **base-ui** (Next + MDX, per-demo parallel styling variants, CodeSandbox export, two playgrounds, llms.txt).

Decide: docs framework, demo authoring format, theme/brand switcher in docs (all 16 permutations viewable — this is the whitelabel sales pitch), playground approach (in-docs vs standalone), API-reference generation (automated from types vs hand-written), whether to also publish a shadcn-style registry, hosting target, and an `llms.txt`/AI-registry story.
