---
id: 015
title: anti-slop research
type: research
status: open
assignee: research-agent
blocked-by: []
---

## Question

What exactly is `https://github.com/dmmulroy/anti-slop`, and how does it integrate into this stack? It's mandated by the brief but unexamined.

Research from the repo/readme/npm: what it does (lint rules? agent guardrails? oxlint plugin?), how it's installed and configured, compatibility with oxlint `^1.x`/oxfmt/pnpm/turborepo, maturity (releases, maintenance), and any conflicts with the refs' existing oxlint setup (type-aware rules, custom `@elmeragroup/oxlint-plugin` with design-system rules like `elmera/require-icon-button-label`).

Deliverable: `wayfinder/research/015-anti-slop.md` — findings + a concrete recommended wiring, consumed by *Repo & tooling spec*.
