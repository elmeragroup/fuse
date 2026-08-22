---
id: 017
title: Spec assembly
type: task
status: closed
assignee: tommy
blocked-by: [004, 006, 009, 011, 012, 013, 014, 016, 018, 019, 020, 021, 022, 023, 024, 025, 026]
---

## Question

Assemble the final deliverable: the implementation-ready architecture & product specification as markdown documents under `docs/spec/`, synthesizing every closed ticket (plus the per-family component API specs that graduate from _Component API spec template_).

Expected document set (adjust as decisions dictate): `architecture.md` (packages, build, distribution), `theming.md` (token contract, cascade mechanism, full value matrix, theme provider), `components/` (per-family API specs + inventory), `tooling.md` (repo scaffold, lint/format/test/CI), `docs-site.md`, `release.md`, `accessibility.md`, `performance.md`, `roadmap.md` (incl. react-aria→base-ui migration path, dark mode, VR testing if deferred), plus a top-level `README`/overview. Each doc must be executable by an implementing agent without returning to the tickets; cross-check for contradictions between decisions before closing.

Note: this ticket cannot claim completion while any per-family API spec ticket (fog, graduating from ticket 011) remains open — re-wire blocked-by as those tickets are created.

## Assets

The assembled specification: [docs/spec/README.md](../../docs/spec/README.md) (entry point) — with [architecture](../../docs/spec/architecture.md), [theming](../../docs/spec/theming.md) (full value matrix embedded), [tooling](../../docs/spec/tooling.md), [docs-site](../../docs/spec/docs-site.md), [release](../../docs/spec/release.md), [roadmap](../../docs/spec/roadmap.md), plus the pre-existing [accessibility](../../docs/spec/accessibility.md), [performance](../../docs/spec/performance.md), and [components/](../../docs/spec/components/) (66 files). ADRs 0001–0006 under [docs/adr/](../../docs/adr/).

## Resolution

Assembled 2026-08-18. Nine top-level chapters + 66 component specs + 6 ADRs; every chapter self-contained (executable without returning to tickets), cross-linked by ownership, with a Sources provenance line. `roadmap.md` absorbs every deferred item with its trigger (react-aria→base-ui migration, dark mode, VR, brands, ring re-mint, locales/subsetting, registry, playground editor, icon codegen) and explicitly excludes the OrderModule migrations.

Cross-check outcomes (contradictions found and reconciled, recorded in the affected doc):

1. **Gate placement**: size-limit runs in the merge gate over built publish artifacts (performance §2, tooling §merge-gate); the publish workflow re-runs it with publint/attw/export-path/theme-contract against the published shape (release §5). Ticket 013's publish-only framing superseded.
2. **CSS entries**: `@elmeragroup/ui/css` (Tailwind source) + `@elmeragroup/ui/themes.css` (token stylesheet) — ticket 008's question-text `ui.css` path superseded by its own resolution; tooling's oxfmt config now references the entry, not a filename.
3. **Handbook nav**: a **Localization** page added to the docs sidebar Handbook group — accessibility §4 mandates the page; ticket 025's group list predated the i18n decision.
4. **`muted-foreground` derivation**: the matrix's "fg / 0.7" is defined (theming §4.5) as a self-contained oklch literal with alpha channel — not a `var()` opacity alias — honoring the contract's no-eager-binding rule; exact emitted literals to be confirmed at pipeline implementation.
5. **GUEN-dark reference values**: downgraded honestly in roadmap.md — the ref's `.guen-dark` block is dead code (double-gated, hex-not-oklch, status trios only), a weak input for the dark rollout, not a starting palette.
6. **`@elmeragroup/lib` helpers (`cn`)**: treated as pass-1 bundle inputs, never published exports — preserving ADR 0005's single-public-package rule (architecture).
