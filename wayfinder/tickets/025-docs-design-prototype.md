---
id: 025
title: Docs site design prototype
type: prototype
status: closed
assignee: tommy
blocked-by: []
---

## Question

What does the docs site actually look like? Stack is fixed ([Docs site & playground](012-docs-and-playground.md): Next + custom MDX, global theme picker, 16-permutation matrix page, generated API tables, llms.txt) — this ticket is the _aesthetic_ half the brief prioritizes: layout, typography, navigation, demo presentation, the matrix/pitch page's look, light-only vs theme-aware docs chrome.

Prototype (UI branch of /prototype): a few radically different visual directions for the component page + the matrix page, switchable, to react to. Consult the frontend-design / emil-design-eng skills per the effort's aesthetics bar. Deliverable: chosen direction linked as an asset; seeds the docs chapter of the spec.

## Assets

- [Prototype: three docs-site directions](../prototypes/025-docs-design.html) — single self-contained HTML file; open in a browser. Switch directions with the floating bar or ←/→; each direction has a Component page (Button) and a 16-theme Matrix page. Demo surfaces use the real ADR-0002 cascade with real values from [004-theme-value-matrix](../research/004-theme-value-matrix.md). Directions: **A — Manual** (quiet three-column reference, light-only chrome, mono theme-coordinate picker), **B — Showroom** (docs chrome painted with the library's own tokens — picking a brand repaints the site; matrix as brand-colored rows), **C — Workbench** (split-pane spec sheet with sticky live canvas; matrix as a full 5×4 coordinate table with the four illegal permutations hatched). Direction A was iterated in place to its final, chosen form (see Resolution).

## Resolution

Decided 2026-08-18, user reaction to the prototype. **Direction A — Manual — wins**, reworked to mirror base-ui's docs closely:

1. **Layout: base-ui-style three columns** — sidebar nav / content (max ~720px) / on-page TOC. Light-only docs chrome (brand color appears only inside demo surfaces); hairline dividers; quiet system-font typography.
2. **No header nav.** The header carries only the wordmark, the global theme coordinate picker (three joined mono selects: variant · brand · segment, pinned brands disable the illegal segment), and Search ⌘K. All navigation lives in the sidebar, grouped base-ui-style with muted normal-case group labels:
   - **Overview** — Quick start, Accessibility, Releases, About
   - **Handbook** — Theming, Theme matrix, Tokens, Brands & segments, Icons, llms.txt
   - **Components** — flat alphabetical list, current page as a soft pill
3. **Demo presentation**: demo frame = dotted canvas stage (dots `color-mix`ed from the active theme's `--foreground` so the theme's real background stays visible) → theme-slug meta row → demo source code, all in one bordered frame (base-ui's demo-then-source card). "View as Markdown / View source" meta links under the lede (they map to the llms.txt / per-component-MD decision).
4. **Tokens consumed section kept** — per-component list of every token the recipe reads, with swatches. Feasible without manual authoring: generated at docs build by statically collecting `var(--…)` references from the component's tv recipe + CSS, same pipeline as the generated API tables. If that extraction ever proves unreliable, drop the section rather than hand-maintain it.
5. **Matrix page**: quiet 16-cell grid (4×4), each cell slug-labelled, rendered via ThemeScope — kept from direction A as prototyped.
6. **Handoff directive for the implementation effort (goes in the spec's docs chapter): dogfood before building the site.** Once the components are scaffolded into the ui package in this repo, create a docs-page prototype _inside the repo, bounded to the ui package_, that consumes the real library components (not this HTML mock) — wiring inspired by base-ui's docs wiring. It must wire 1–2 real components: Button plus one complex one (e.g. Combobox or Dialog). That dogfooded prototype — not this artifact — is the working reference when the docs site is actually implemented; this artifact is the layout/aesthetic source it copies.
