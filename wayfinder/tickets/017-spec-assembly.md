---
id: 017
title: Spec assembly
type: task
status: open
assignee: null
blocked-by: [004, 006, 009, 011, 012, 013, 014, 016]
---

## Question

Assemble the final deliverable: the implementation-ready architecture & product specification as markdown documents under `docs/spec/`, synthesizing every closed ticket (plus the per-family component API specs that graduate from *Component API spec template*).

Expected document set (adjust as decisions dictate): `architecture.md` (packages, build, distribution), `theming.md` (token contract, cascade mechanism, full value matrix, theme provider), `components/` (per-family API specs + inventory), `tooling.md` (repo scaffold, lint/format/test/CI), `docs-site.md`, `release.md`, `accessibility.md`, `performance.md`, `roadmap.md` (incl. react-aria→base-ui migration path, dark mode, VR testing if deferred), plus a top-level `README`/overview. Each doc must be executable by an implementing agent without returning to the tickets; cross-check for contradictions between decisions before closing.

Note: this ticket cannot claim completion while any per-family API spec ticket (fog, graduating from ticket 011) remains open — re-wire blocked-by as those tickets are created.
