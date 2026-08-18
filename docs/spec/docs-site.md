# Documentation site & playground

Normative chapter for the `@elmeragroup/ui` docs site, demo pipeline, playground, and AI-docs surface. Sources: [Docs site & playground](../../wayfinder/tickets/012-docs-and-playground.md), [Docs site design prototype](../../wayfinder/tickets/025-docs-design-prototype.md), [Component spec conventions](components/conventions.md); the aesthetic source of record is the prototype asset [`wayfinder/prototypes/025-docs-design.html`](../../wayfinder/prototypes/025-docs-design.html) (direction **A — Manual**, as iterated in place to its final form).

## 1 Stack

- **Framework: Next + a custom MDX pipeline** — the base-ui route. This is a deliberate trade: aesthetics and total design freedom **outrank automation**, and the higher build cost versus an off-the-shelf docs framework (fumadocs et al.) is accepted knowingly. Do not substitute a docs framework "to save time" — that decision is closed.
- The docs site is a **workspace app** in this repo (alongside the packages, per [architecture](architecture.md)), consuming the library via **workspace source exports** (`publishConfig.directory` mapping) — never the built artifacts. Demos, docs pages, and the playground all import the same source the package publishes.
- Docs chrome is **light-only**; brand color appears **only inside demo surfaces**. The site itself never repaints when the theme picker changes (that was direction B, rejected).

## 2 Implementation sequencing — dogfood before building the site (mandatory)

This ordering rule is normative; the docs site MUST NOT be started ahead of it.

1. Once components are scaffolded into the `ui` package, build a **docs-page prototype inside this repo, bounded to the ui package**, consuming the **real library components** — not the HTML mock. Wiring is inspired by base-ui's own docs wiring (MDX page → demo component → extracted source).
2. The prototype must wire **1–2 real components: Button plus one complex component** (e.g. Combobox or Dialog): full page anatomy — demo frame, extracted source, generated API table, Tokens-consumed section, TOC.
3. **That dogfooded prototype is the working reference** for the docs-site implementation. The HTML artifact ([`wayfinder/prototypes/025-docs-design.html`](../../wayfinder/prototypes/025-docs-design.html)) is the layout/aesthetic source the prototype copies — never the wiring reference.

## 3 Visual design

The chosen direction mirrors base-ui's docs closely. Everything in this section is normative; pixel-level reference is the prototype asset.

### 3.1 Layout

- **Three columns**: sidebar nav / content column (max-width ≈ 720 px) / on-page TOC. Hairline dividers between regions; quiet system-font typography; no decorative chrome.
- The **on-page TOC** (right column) lists the current page's headings; it collapses away below the width that fits three columns.

### 3.2 Header

**No header navigation.** The header carries exactly three things:

1. The **wordmark** (left).
2. The **global theme coordinate picker**: three **joined mono-font selects** — variant · brand · segment. Pinned brands **disable the illegal segment option** (the picker can never express one of the four illegal permutations); legality rules per [theming](theming.md).
3. **Search, ⌘K** (right).

### 3.3 Sidebar navigation

All navigation lives in the sidebar, grouped base-ui-style with **muted, normal-case group labels**. The groups and their contents:

- **Overview** — Quick start, Accessibility, Releases, About.
- **Handbook** — Theming, Theme matrix, Tokens, Brands & segments, Icons, Localization, llms.txt.
- **Components** — flat alphabetical list of every published component; the current page renders as a **soft pill**.

The Quick start page shows the expected app page scaffold (landmarks/skip links/`lang`) once, per [accessibility](accessibility.md) §2. The **Localization** Handbook page is the i18n handbook page required by [accessibility](accessibility.md) §4: mechanism, supported-locale union, override precedence, language-switcher recipe. The **Tokens** page publishes the measured bundle sizes per entry alongside the token reference, per [performance](performance.md) §2.

### 3.4 Component page anatomy

Top to bottom:

1. **H1 + lede** (one-paragraph description from the MDX frontmatter/spec header).
2. **Meta links under the lede**: **View as Markdown** (the per-component markdown endpoint, §9) and **View source** (the component's source file on the repo host).
3. **Demo frames** (§3.5), one per spec §10 scenario.
4. **API reference** tables (§8), one per compound part.
5. **Tokens consumed** — a per-component list of every token the component's recipe reads, **with color swatches**. This section is **generated, never hand-authored**: at docs build, statically collect `var(--…)` references from the component's tv recipe + CSS — the same pipeline as the generated API tables. Ruling: if that extraction ever proves unreliable, **drop the section rather than hand-maintain it**.

### 3.5 Demo frame

One **bordered frame** per demo (base-ui's demo-then-source card), three stacked regions:

1. **Stage**: a **dotted canvas** rendering the live demo under the active theme. The dots are `color-mix`ed from the active theme's `--foreground` so the theme's **real background stays visible** — the stage is theme-tinted, not a neutral checkerboard.
2. **Theme-slug meta row**: the active theme coordinate (e.g. `default·elmera·private`) printed in mono between stage and source.
3. **Demo source code**: the demo file's extracted source, syntax-highlighted.

## 4 Theme switching

- The header picker is **host-owned state that re-renders the `ThemeProvider`** — the provider-consumption model specified in [theming](theming.md). The docs site is itself the first consumer exercising that API: no bespoke theme plumbing, no docs-only escape hatch.
- Demo stages render under the globally selected theme; every demo is therefore viewable in all 16 permutations by driving the picker.
- Nested per-cell theming (matrix page, any side-by-side comparison) uses **`ThemeScope`** per [theming](theming.md) — overlays portalled inside the active scope per [conventions](components/conventions.md).

## 5 Theme matrix page

The whitelabel pitch page, under Handbook:

- A **quiet 16-cell grid (4×4)** — every legal brand × segment × variant permutation. Each cell is **slug-labelled** (mono) and renders a fixed set of key components inside its own `ThemeScope`.
- Chrome stays light-only; the cells carry all the color. No hatched illegal cells, no coordinate-table framing (direction C, rejected) — the 16 legal permutations only.

## 6 Demo pipeline

- Demos are **plain runnable `.tsx` files** (kumo pattern), one per component spec §10 scenario, co-located per [conventions](components/conventions.md). No MDX-embedded JSX demos, no code-in-string demos.
- **One authored demo file feeds multiple outputs**:
  1. **Docs extraction** — AST-extracted at docs build into the demo frame's live render + displayed source.
  2. **Visual-regression targets** — the same files are the VR suite's render entries (testing strategy chapter).
  3. **AI registry** — the same source is embedded verbatim in the per-component markdown endpoint (§9).
- Demos import the library via **workspace source exports** only — the exact specifiers a consumer would write (`@elmeragroup/ui/...`), resolved to source in the workspace. Never relative imports into package internals.
- Demo code is exemplary consumer code: it obeys every consumer-facing convention (tokens-only classes, `cn`, Field composition) because it is shipped as copyable source three ways.

## 7 Playground

- A **standalone workspace app** (not an in-docs sandbox) consuming source exports — **instant HMR** against library source is the point.
- **No in-browser editor in v1** — no Sandpack/CodeSandbox embeds, no shareable-snippet infrastructure. The playground is a local development surface for library authors and demo authoring.

## 8 API reference generation

- API tables are **generated from TS types at docs build**; prop descriptions come from **JSDoc on the props** — once code exists, code is the single source of truth. The spec chapters' hand-written §3 tables are the **authoring input until then**, then demoted to provenance.
- Every generated table carries an **RSC-status column** (server-safe vs `"use client"`) per [performance](performance.md) §3 — RSC status is public contract, and the docs surface it mechanically, not editorially.
- Generation failures (unresolvable type, missing JSDoc on a public prop) **fail the docs build** — no silent empty cells.

## 9 AI docs

- **`llms.txt`** at the site root: index of every docs page with one-line descriptions, generated at docs build. It has a Handbook page explaining the surface.
- **A markdown endpoint per component** (`/components/<name>.md` or equivalent): the component's API reference + demo source, generated from the **same spec/demo sources** at docs build — one pipeline, three consumers (HTML docs, VR, AI). The component page's **View as Markdown** link points here.
- **No shadcn-style registry in v1.** The library is a packaged dependency, not copy-paste source; a registry is a roadmap note only if demand appears.

## 10 Hosting

- **Vercel** — first-class Next hosting.
- **Per-PR preview deploys** are required infrastructure, not a nicety: docs previews are the review surface for demo and component changes.
