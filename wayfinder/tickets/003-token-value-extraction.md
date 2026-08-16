---
id: 003
title: Token value extraction
type: research
status: open
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

Deliverable: `wayfinder/research/003-token-values.md` — a matrix + gap list, consumable by the *Brand–segment matrix gaps* ticket.
