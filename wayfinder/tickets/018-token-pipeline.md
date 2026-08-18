---
id: 018
title: Token pipeline
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: []
---

## Question

How do the 16 theme stylesheets get authored and shipped: **hand-written CSS files** or **kumo-style codegen** (typed TS value table → generated CSS)?

Inputs now fixed: the token contract ([Canonical token contract](001-canonical-token-contract.md) — ~77 role tokens, public primitives, defaults + must-override model) and the selector mechanism ([Theming cascade prototype](002-theming-cascade-prototype.md) — three data attributes, ~13-rule structure with fallback-by-absence).

Decide: (a) hand-authored vs codegen vs hybrid; (b) if codegen, the source-of-truth shape (typed config per theme? one matrix?), where generation runs (build step vs committed output), and how must-override enforcement happens (type-level? lint? test?); (c) how the dual CSS distribution kumo does (per-theme files vs one all-themes file) applies here; (d) how dark-mode reservation and future brands slot in without pipeline rework.

Evidence so far: the cascade prototype generated three mechanisms' CSS from one pure value table trivially and caught drift by construction (see its resolution, bonus finding); kumo reference uses codegen'd theme tokens + dual CSS distribution (per map Notes). The full value input now exists: [004 theme value matrix](../research/004-theme-value-matrix.md).

Requirement from [Theme provider API](006-theme-provider-api.md): the emitted theme CSS ships a ready-to-go **empty `[data-theme="dark"]` section** (comment only — values land with the dark-mode roadmap item), since `ColorSchemeScript` sets that attribute functionally from v1.

## Resolution

Decided 2026-08-17 via grilling — codegen across the board.

1. **Codegen, not hand-authored.** Typed TS theme definitions → generator emits the theme CSS in the 13-rule layer structure of [ADR 0002](../../docs/adr/0002-theme-attributes.md) (defaults → brand pointers → internal base → external palettes → segment deltas, fallback by absence). The [value matrix](../research/004-theme-value-matrix.md) becomes documentation; TS is the source of truth. The cascade prototype's generator is the shape's proof.
2. **Source: per-theme-layer TS modules** validated against a contract type whose **required fields are exactly the must-override tokens** — type-level enforcement of the completeness model, re-checked at the CSS level by the theme-contract test ([Testing strategy](013-testing-strategy.md)). Adding brand 17 = one new file.
3. **Generation runs in the turbo build task; output is not committed.** A **CSS snapshot test** is the committed, reviewable artifact — value changes surface in PR diffs via the snapshot, with no stale-generated-file failure mode.
4. **Output: a single `themes.css` entry** (all 16 permutations — tiny by construction), included in both distribution modes ([Package architecture](008-package-architecture.md)), containing the commented-empty `[data-theme="dark"]` section. Per-theme file splitting rejected as premature at this size.
