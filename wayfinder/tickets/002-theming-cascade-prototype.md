---
id: 002
title: Theming cascade prototype
type: prototype
status: open
assignee: null
blocked-by: []
---

## Question

Does the **data-attribute theming mechanism scale**? The user favors `data-theme-variant` / `data-theme-brand` / `data-theme-segment` on `<html>`/`<body>` over single theme classes (both refs use classes today: `.fkas`, `.fkas-c`, `.v2 .fkas`), mainly to keep `data-theme` free for future light/dark.

Build a small throwaway prototype (plain CSS + a demo page is enough) that answers:

1. Can 16 permutations (8 internal + 8 external) be expressed with attribute-combination selectors (`[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]`) without a combinatorial explosion of CSS — and how do shared/fallback rules read (e.g. external tkas company falling back to tkas private values)?
2. Specificity & cascade behavior: attribute selectors vs the class approach, interaction with Tailwind v4 `@theme inline` variable mapping, and with nested re-scoping (OrderModuleWeb re-scopes a `<main>` subtree and portals dialogs *inside* it so overlays inherit theme vars — the mechanism must support scoped subtrees and portals).
3. Ergonomics: what the generated CSS looks like per theme file, and whether a hybrid (one `data-theme="<slug>"` attribute carrying the full slug) is simpler than three attributes.

Deliverable: prototype linked from this ticket + a recommendation (three attributes vs single slug attribute vs classes).
