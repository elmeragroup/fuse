---
id: 015
title: anti-slop research
type: research
status: closed
assignee: research-agent
blocked-by: []
---

## Question

What exactly is `https://github.com/dmmulroy/anti-slop`, and how does it integrate into this stack? It's mandated by the brief but unexamined.

Research from the repo/readme/npm: what it does (lint rules? agent guardrails? oxlint plugin?), how it's installed and configured, compatibility with oxlint `^1.x`/oxfmt/pnpm/turborepo, maturity (releases, maintenance), and any conflicts with the refs' existing oxlint setup (type-aware rules, custom `@elmeragroup/oxlint-plugin` with design-system rules like `elmera/require-icon-button-label`).

Deliverable: `wayfinder/research/015-anti-slop.md` — findings + a concrete recommended wiring, consumed by _Repo & tooling spec_.

## Resolution

Findings: [research/015-anti-slop.md](../research/015-anti-slop.md).

anti-slop is a pack of 15 opinionated AST-only **oxlint JS-plugin rules** (`anti-slop/*`) targeting AI-slop patterns (type-assertion laundering, `unknown` escape hatches, module mocking, reflection). Same plugin mechanism (`eslintCompatPlugin` from `@oxlint/plugins`) as the refs' own `@elmeragroup/oxlint-plugin` — fully compatible with oxlint ^1.x (align at ≥1.78), oxfmt, type-aware linting, pnpm, turborepo; no namespace collision.

Key facts: it is **vendor-first by design** — `private: true`, unreleased, not npm-published by the author; `oxlint-plugin-anti-slop@0.0.0` on npm is a **third-party name-squat, never install it**. Repo is days old, single author — immature as a dependency, fine as vendored code.

Recommended wiring (feeds _Repo & tooling spec_): vendor as `tooling/oxlint-anti-slop` (`@elmeragroup/oxlint-plugin-anti-slop`), register as a third `jsPlugins` entry, ~11 rules at `error`, the contentious ones (`no-module-mocking`, `no-shape-in-symbol-names`, `require-safety-comment-for-type-assertion`) at `warn`/overrides, record the vendored commit SHA.
