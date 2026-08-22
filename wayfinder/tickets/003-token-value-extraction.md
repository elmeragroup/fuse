---
id: 003
title: Token value extraction
type: research
status: closed
assignee: research-agent
blocked-by: []
---

## Question

What are the **actual token values** available today for every brand/segment permutation, and where are the gaps?

Extract from `.ref/OrderModuleWeb/packages/ui/src/styles/brands.css` (+ `ui.css`) and `.ref/OrderModuleInternalWeb/packages/ui/src/styles/ui.css` a complete value matrix: every CSS variable × every brand block (`.fkas`, `.fkas-c`, `.tkas`, `.guen`, `.guen-dark`, `.fkse` external; `.fkas/.tkas/.guen/.fkab/.steddi` + `.v2` internal), including radii, fonts (from the Next font setup in both apps), and the shared status block.

Explicitly flag the gaps and oddities the spec must later resolve:

- No external `tkas`/`guen` **company** palettes exist (only fkas has `-c`).
- No external `fkab` block exists at all; internally `--brand-fkab` equals `--brand-fkas`.
- `fkse` renders as Telinet (logo + palette).
- Legacy HSL triplets that are dead or overridden (per-brand `--destructive`, `.ngeas` block).
- `guen-dark` values (out of scope for v1 but record them).

Deliverable: `wayfinder/research/003-token-values.md` — a matrix + gap list, consumable by the _Brand–segment matrix gaps_ ticket.

## Resolution

Findings: [research/003-token-values.md](../research/003-token-values.md).

Complete value matrices extracted with file:line citations: external new-color set (23 vars × fkas/fkas-c/tkas/guen/fkse in oklch), `.guen-dark` block, legacy HSL triplets, per-brand radii, shared status block, and the entire internal theme (`:root` brand accents, neutral ramp, `.dark`/`.inverted`, per-brand blocks, `.v2` grayscale, `@theme` mappings). Fonts: Roboto is primary everywhere; Neo Sans is fkas-external heading only; internal never populates `--font-heading`.

**22 gaps & oddities catalogued** — all five anticipated ones confirmed (no external tkas/guen company palettes; no external fkab and internal `--brand-fkab` ≡ `--brand-fkas`; fkse = Telinet; dead per-brand `--destructive`; guen-dark recorded but never applied), plus extras the contract must handle: internal `.v2.<brand>` specificity kills per-brand `--primary`; `.v2.fkse`/`.v2.ngef` selectors exist with no backing vars; the two vocabularies collide on shared names (`--primary` means different things per ref); `.fkas-c` misses `--inactive`; tkas-only `--primary-light`; shared violet `--ring` across all brands. Feeds _Brand–segment matrix gaps_ (now waiting only on _Canonical token contract_).
