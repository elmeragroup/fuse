# Documentation site

Normative chapter for the `@elmeragroup/ui` docs site, demo pipeline, and AI-docs surface.

## 1 Stack

- **Framework: Next + a custom MDX pipeline** — the base-ui route. This is a deliberate trade: aesthetics and total design freedom **outrank automation**, and the higher build cost versus an off-the-shelf docs framework (fumadocs et al.) is accepted knowingly. Do not substitute a docs framework "to save time" — that decision is closed.
- **Authoring model** _(amended 2026-08-24 — ruling 74b, 2026-08-24: hand-authored `page.mdx` via `@next/mdx`, demos imported as ordinary ESM; this superseded the earlier AST-extraction plan)_: component pages are **hand-authored `page.mdx` route files** compiled by `@next/mdx` (with the repo's remark/rehype choices), living at `apps/docs/src/app/(docs)/components/<slug>/page.mdx`. A page imports its demos and renders its generated sections (§6, §8) as **ordinary React components via plain ESM imports** — no pre-compiled MDX shells, no closed frontmatter demo registry, no generated module maps. Frontmatter carries only page metadata (title, lede) that the build reads for nav, search, and llms.txt.
- The docs site is a **workspace app** in this repo (alongside the packages, per [architecture](architecture.md)), consuming the library via **workspace source exports** (`publishConfig.directory` mapping) — never the built artifacts. Demos and docs pages import the same source the package publishes.
- Docs chrome is **light-only**; brand color appears **only inside demo surfaces**. The **document** theme is fixed at `internal-elma-private` on every route that emits `<html>` and does not follow the demo picker (direction B remains rejected).
- **Styling**: docs chrome and authored docs surfaces use statically discoverable Tailwind v4 utility strings. `apps/docs/src/styles/globals.css` is the only docs-owned stylesheet and is limited to Tailwind/library imports, the Typography plugin (`@plugin "@tailwindcss/typography"`), a CSS-first `@utility prose-docs` theme (docs `--tw-prose-*` colors and the mono font for `code`/`kbd`/`samp`/`pre` only — Typography `prose-sm` spacing and type scale are the source of truth; the `max-w-none` width release sits in the `DocsProse` component recipe with the other prose utilities, not in the CSS utility), `@source`, and docs-local `@theme` tokens. Reusable styling contracts live behind React components with private docs `tv` recipes; callers consume those components, never exported class-name constants or public recipes. Docs components use `tv` slot recipes for their class maps; a slot string shared by more than one docs component lives in one shared recipe. Component CSS, `@apply`, and dynamic undetectable utilities are not used. The stage's `data-demo-stage` attribute is the required selector hook for the generated library density artifact, not a docs-owned component stylesheet; docs class strings carry utilities only, never marker class names. _(Amended 2026-09-03 — this bullet placed `max-w-none` inside the `@utility prose-docs` block; it lives on the `DocsProse` recipe. Amended 2026-09-04 — ticket 07, 2026-09-04: docs components use `tv` slot recipes for their class maps.)_

## 2 Implementation sequencing — docs-app MVP is the allowed dogfood

This ordering rule **replaces** the former constraint that `apps/docs` must wait for an in-package prototype (Button plus a complex overlay such as Combobox or Dialog, with extracted source and generated API tables). A later agent reading only this chapter **starts** `apps/docs` at the MVP scope below. Do **not** wait for an in-package prototype, Combobox/Dialog, or library Sidebar, and do **not** treat any leftover “must not start the docs site” sentence as current.

1. **Allowed first consumer.** After foundation (`/theme`, tokens, public entries) plus `Button` and `ScrollArea` ship, the first consumer **may be the docs app itself** (`apps/docs`). It consumes the real library via workspace source exports — not the HTML mock, and not a prototype bounded inside `packages/ui`.
2. **MVP scope (this first slice / PoC).** Next workspace app, base-ui docs route-group shape:
   - `(docs)` — the working three-column shell: light-only header (wordmark + preview theme-coordinate selects; **no** command-palette / ⌘K search in this slice), a **docs-local SideNav** (left), content, and a **docs-local QuickNav** (right-column on-page TOC). Both navs are app-local compositions over `@elmeragroup/ui/scroll-area` (a `<nav>` wrapping a `ScrollArea` viewport and vertical scrollbar). They are **not** the library Sidebar and **must not** import `@elmeragroup/ui/sidebar`. Library Sidebar is not required for docs chrome. This route is the verified Next App Router first-paint host: `themeAttributes` and `densityAttributes(defaultDensityForVariant(DOCUMENT_THEME.variant))` (`dense`) on `<html>`, `ColorSchemeScript` in `<head>` before SkipNav/shell, one `ThemeProvider` with `theme={DOCUMENT_THEME}` (`internal-elma-private`) and `injectColorSchemeScript={false}`, token-backed canvas, `suppressHydrationWarning` for `data-theme`. Docs does not add density as a fourth theme-matrix axis; comfortable is the built-stylesheet contract plus an isolated static-theme stamp.
   - `(private)` and `(website)` — **reserved blank shells** (empty pages) so those groups can be filled later without restructuring. Their document roots still stamp the three `internal-elma-private` brand attributes, `data-density="dense"`, and import token CSS so JS-disabled brand and density are visible. They do **not** mount `ThemeProvider`, picker, preview context, or a color bootstrap while they remain empty. If they later grow paintable chrome, they adopt the `(docs)` adapter.
   - Live pages for **Button** and **ScrollArea** that render the library components (package §10 demos may be reused). The HTML prototype that set the layout/aesthetic was retired at v1; the docs app itself is now the source of record.
3. **Still forbidden in this PoC.** The MVP is **not** the full docs pipeline. Do **not** implement generated API tables (§8), demo AST extraction (§6), or command-palette / ⌘K search (§3.2 item 3) in this slice. Full §3.4 page anatomy (generated Tokens-consumed, extracted source frames) waits on that pipeline. Those remain the later, complete-site contract in the sections below; they are not a gate on starting `apps/docs`.

## 3 Visual design

The chosen direction mirrors base-ui's docs closely. Everything in this section is normative; pixel-level reference is the prototype asset.

### 3.1 Layout

- **Three columns**: docs-local SideNav / content column (max-width ≈ 720 px) / docs-local QuickNav (on-page TOC). Hairline dividers between regions; quiet system-font typography; no decorative chrome. Neither column is the library Sidebar; both scroll via `ScrollArea` (§2).
- The **on-page TOC** (right column, QuickNav) lists the current page's headings; it collapses away below the width that fits three columns.

### 3.2 Header

**No header navigation.** The complete-site header carries exactly three things:

1. The **wordmark** (left).
2. The **preview theme coordinate picker**: three **joined mono-font selects** — variant · brand · segment. It writes docs-local preview state consumed by demo `ThemeScope`s; it does **not** change the document `ThemeProvider` or `<html>` brand attributes (§4). Pinned brands **disable the illegal segment option** (the picker can never express one of the four illegal permutations); legality rules per [theming](theming.md).
3. **Search, ⌘K** (right). Complete-site contract; **omitted from the docs-app MVP** (§2). The MVP header is wordmark + theme-coordinate selects only.

The complete-site search keeps focus in its combobox input while `aria-activedescendant` identifies the selected result. End, Home and arrow navigation reveal that option by scrolling only the result list; the surrounding page retains its scroll position. Filtering selects the first matching result, and Enter activates the linked active option. Production browser coverage measures the actual option/list rectangles with an overflowing result set.

### 3.3 Sidebar navigation

This left column is the **docs-local SideNav** (base-ui docs pattern), not `@elmeragroup/ui/sidebar`. All navigation lives there, grouped base-ui-style with **muted, normal-case group labels**. The groups and their contents:

- **Overview** — Quick start, Accessibility, Releases, About.
- **Handbook** — Theming, Theme matrix, Tokens, Brands & segments, Icons, Localization, llms.txt.
- **Components** — flat alphabetical list of every published component; the current page renders as a **soft pill**.

The Quick start page shows the expected app page scaffold (landmarks/skip links/`lang`) once, per [accessibility](accessibility.md) §2. The **Localization** Handbook page is the i18n handbook page required by [accessibility](accessibility.md) §4: mechanism, supported-locale union, override precedence, language-switcher recipe. The **Tokens** page publishes the measured bundle sizes per entry alongside the token reference, per [performance](performance.md) §2.

### 3.4 Component page anatomy

Top to bottom:

1. **H1 + lede** (one-paragraph description from the MDX frontmatter/spec header).
2. **Meta links under the lede**: **View as Markdown** (the per-component markdown endpoint, §9) and **View source** (the component's source file on the repo host).
3. **Demo frames** (§3.5), one per reviewed demo scenario.
4. **API reference** tables (§8), one per compound part.
5. **Tokens consumed** — a per-component list of every token the component's recipe reads, **with color swatches**. This section is **generated, never hand-authored**: at docs build, statically collect `var(--…)` references from the component's tv recipe + CSS — the same pipeline as the generated API tables. Ruling: if that extraction ever proves unreliable, **drop the section rather than hand-maintain it**.

### 3.5 Demo frame

One **bordered frame** per demo (base-ui's demo-then-source card), three stacked regions:

1. **Stage**: a **plain canvas** rendering the live demo under the active theme on the theme's own `--background` — the stage is theme-tinted, not a neutral checkerboard, and carries no pattern so the demo's surfaces read exactly as they would in an app.
2. **Theme-slug meta row**: the active theme coordinate (e.g. `external·fkas·private`) and its deployment-default density (`dense` / `comfortable`) printed in mono between stage and source.
3. **Demo source code**: the demo file's extracted source, syntax-highlighted.

## 4 Theme switching

- The **document** `ThemeProvider` is fixed at `internal-elma-private`. The header picker does **not** re-render that provider and must not change `document.documentElement` brand attributes.
- Picker state lives in a docs-local **preview** context. Only `DemoFrame` / `ThemeScope` consume it. Changing the picker updates demo scope attributes and live token appearance; chrome stays internal/Elmera/private.
- Demo stages render under the preview-selected theme; every demo is therefore viewable in all 20 permutations by driving the picker. `DemoFrame` stamps `data-density` from `defaultDensityForVariant(preview.variant)` on the stage; `globals.css` imports `@elmeragroup/ui/demo-stage-comfortable.css` — a generated re-scope of the library comfortable `--control-*` block onto `[data-demo-stage]`. `DemoStage` stamps that attribute on the stage element so the generated selector matches. That is a preview sandbox, not nested density in library CSS: `ThemeScope` still does not own density, the document root stays `dense`, and the 20-cell matrix stays a colour grid (no 20×2). Honest document-root comfortable remains the isolated static-theme stamp.
- Nested per-cell theming (matrix page, any side-by-side comparison) uses **`ThemeScope`** per [theming](theming.md) — overlays portalled inside the active scope per [component authoring](../component-authoring.md). The preview context is docs-local, not a library export.

## 5 Theme matrix page

The whitelabel pitch page, under Handbook:

- A **quiet 20-cell grid** — every legal brand × segment × variant permutation, including `elma`. Each cell is **slug-labelled** (mono) and renders a fixed set of key components inside its own `ThemeScope`.
- Chrome stays light-only; the cells carry all the color. No hatched illegal cells, no coordinate-table framing (direction C, rejected) — the 20 legal permutations only.

## 6 Demo pipeline

Required scenarios live in `apps/docs/test/fixtures/component-demo-requirements.json`. The docs tests compare this reviewed coverage list with authored pages independently of the generated manifest. Update the list deliberately when scenarios change.

- Demos are **plain runnable `.tsx` files**, one per reviewed demo scenario, and they **live in the docs app, co-located with the component's page**: `apps/docs/src/app/(docs)/components/<slug>/demos/<demo>.tsx` (base-ui authoring model). Demos are docs/VR/AI source material, never published package code, so they are scoped to the app that consumes them. No MDX-embedded JSX demos, no code-in-string demos. _(Amended 2026-08-24 — ruling 74b, 2026-08-24: demos moved out of `packages/ui` into the docs app; one file is both the live render and the displayed source.)_
- The component page **imports each demo as an ordinary ESM module** (`import { ButtonHero } from "./demos/hero"`) and renders it inside the §3.5 frame; the frame's displayed source is the **same file read verbatim from disk** by the docs app at build/render time and syntax-highlighted. No AST extraction step, no demo registry, no copy: one file is both the live render (via import) and the displayed source (via read).
- **One authored demo file feeds multiple outputs**:
  1. **Docs** — live render + displayed source, as above.
  2. **Visual-regression targets** — the VR suite (roadmap) globs the docs-app demo directories as its render entries, the base-ui precedent (`test/regressions/fixtures.ts` there).
  3. **AI registry** — the same source is embedded verbatim in the per-component markdown endpoint (§9).
- Demos import the library via **workspace source exports** only — the exact specifiers a consumer would write (`@elmeragroup/ui/...`), resolved to source in the workspace. Never relative imports into package internals, never relative imports of other demos.
- Demo code is exemplary consumer code: it obeys every consumer-facing convention (tokens-only classes, `cn`, Field composition) because it is shipped as copyable source three ways.
- **Every demo is a client module.** A demo's first statement is `"use client"`, authored in the file; the generator and `docs-inspection` fail generation when it is missing and never insert it. Rationale: a namespace compound (`Dialog.Root`, `ScrollArea.Bar`) is a plain object exported from a client module, and a server component only sees an opaque client reference for such an export, so member access resolves to `undefined` at prerender. A consumer's page writes the same directive for the same reason, so the shown source stays what a consumer would write and byte-for-byte the file that rendered the stage — a directive grafted on in transit would break that identity. The same rule covers docs chrome modules that dot into a compound, such as `theme-matrix.tsx`: they carry the directive with a comment naming this reason, since they own a client boundary, not state ([performance](performance.md) §3). _(Amended 2026-09-02 — [ADR 0009](../adr/0009-docs-client-boundaries.md), **pending owner confirmation**; the alternative not taken was a generator that adds the directive only when a demo imports client-only symbols.)_
- **Non-public specifier carve-out.** `@internationalized/date` is a consumer specifier, not a carve-out: it is the value type the date cluster's API takes (`CalendarDate`), so a consumer imports it too — and each of the five date-cluster pages (calendar, range-calendar, date-field, date-picker, date-range-picker) says so in prose, telling the reader to install the package themselves rather than reach it through `@elmeragroup/ui`. _(Amended 2026-09-03 — the install note is now required page copy; no page carried it.)_ Exactly three demos may import a specifier a consumer could not reach through `@elmeragroup/ui/*`, because their required scenario cannot be expressed through the public API: `calendar-rtl.tsx` (`I18nProvider` from `react-aria-components` for an RTL locale), `date-field-date-input.tsx` (raw RAC `DateField`/`Label` around the exported `DateInput`), and `scroll-area-composed.tsx` (`@base-ui/react/scroll-area` primitives with two `ScrollArea.Bar`s). The list is closed and tested (`apps/docs/test/demo-imports.test.ts`); a new demo needing a non-public specifier amends this bullet first. `apps/docs/package.json` carries `react-aria-components` and `@base-ui/react` for these three files only. _(Amended 2026-09-02 — [ADR 0009](../adr/0009-docs-client-boundaries.md), **pending owner confirmation**; the alternative not taken was rewriting the three demos.)_
- **Single variant.** A demo is one Tailwind-styled file; there is no CSS-Modules/Tailwind variant switcher (base-ui's dual-variant machinery is explicitly not adopted).

## 7 Local component development

- Use the docs app and its component demos for local development and manual checks. Workspace source exports give library edits instant HMR.
- Standalone playgrounds and in-browser editors are deferred beyond v1. There are no Sandpack/CodeSandbox embeds or shareable-snippet infrastructure. Revisit a separate app when the docs workflow creates a concrete limitation. _(Amended 2026-09-05: keep v1 component development in the docs app.)_

## 8 API reference generation

- API tables are **generated from TS types at docs build**; prop descriptions come from **JSDoc on the props**. Code is the mechanical source for generated reference pages, while this spec remains the normative contract: an API change updates the implementation, authored component docs, tests, JSDoc, and changeset together. Generated output never silently overrules the spec.
- **Committed, validated artifact** _(amended 2026-08-24 — ruling 74b, 2026-08-24: each component commits a co-located `api.json`; CI regenerates and fails on drift)_: the generator writes each component's API data to a **co-located `api.json` next to its `page.mdx`**, and that file is **committed**. API changes therefore show up as reviewable diffs in the same PR that changes the component. A CI check regenerates and fails on drift (the base-ui `types.md` + `docs:validate` model, with JSON as the format so the page renders the artifact directly — no markdown round-trip parser).
- **Presentation** _(amended 2026-08-24)_: the reference renders base-ui-style — per compound part, a table of **Prop · Type · Default** rows where each row **expands** (native `details`/`summary`) to the full description, complete type signature, and default. The closed row shows a **collapsed short type** (single-line heuristic: handlers → `function`, long unions → `Union`, …); the full signature lives in the expanded panel. Highlighted code on the site — MDX fences, the §3.5 demo source region, and that expanded signature — renders through one docs component (`DocsCodeBlock`, raw `source` in, sugar-high markup out); nothing else builds highlighted HTML. The accordion is a client module, so the server renders its signature blocks and passes them down as elements: the highlighter stays off the client graph. _(Amended 2026-09-02 — [ADR 0009](../adr/0009-docs-client-boundaries.md).)_ Required props carry a marker; a missing default renders as an em-dash. Columns collapse progressively on narrow viewports from one DOM tree.
- **One generator** _(amended 2026-09-07 — [ADR 0010](../adr/0010-internal-package-owns-extraction-and-lint.md))_: `generateApiArtifacts` from `@elmeragroup/internal` produces every `api.json`: part discovery, printed types, requiredness, destructuring defaults, JSDoc, RSC status, and the documented `@base-ui/react` dependency props that the part forwards, rendered by HTML and markdown consumers in a separate **Base UI primitive props** group. React and DOM props remain opaque and are represented by the forwarded-prop summary. A default declared by the library wrapper takes precedence over the dependency's JSDoc default. A facade that only re-exports a dependency (`focusable`) publishes each re-export as a part with no props, its `sourcePath` and `rsc` taken from the authored module and the dependency named in `forwardedFrom`. The page's own RSC badge is read from its implementation module's directive, not from the artifact. This replaced the hybrid checker-walk-plus-extractor pipeline of ADR 0007, which had itself superseded the AST-extraction plan (ruling 74b, 2026-08-24: no `@mui/internal-docs-infra`; one committed `api.json` per page).
- **One extraction seam** _(amended 2026-09-07)_: `apps/docs/scripts/lib/api-artifact.ts` is the only caller of the generator. The generation pass runs it in `write` mode, which rewrites a committed `api.json` only when its bytes change and records which files were stale; the drift check (`test/api-artifact.test.ts`) runs the same call in `check` mode, which fails naming each stale file and the regen command, so the two cannot disagree about what a component's API is. Every docs input check runs before the pass writes anything. Demo and route validation lives only in `docs-inspection`, which the pass imports rather than copies.
- **Complete persisted types**: the checker-backed printer disables diagnostic truncation when serializing types. Generated JSON, component Markdown, and expanded signatures preserve every union member; only the closed table row may abbreviate the type.

- **Template-literal string unions** _(amended 2026-09-02)_: the extractor renders a union of template-literal members as a union of template-literal strings, in source order, and does not emit `unsupported-type-fallback` for that shape. The PhoneNumberField `autocomplete` prop is the library example: the API table shows the legal values instead of `any`.
- **Base UI render-prop unions** _(amended 2026-09-02)_: a `render` prop typed `ComponentRenderFn | ReactElement` extracts with both members rendered; external members become external references. The extractor does not emit `unsupported-type-fallback` for that shape. Sidebar's `useRender.ComponentProps` mixins are the library example.
- Every part surfaces its **RSC status** (server-safe vs `"use client"`) mechanically per [performance](performance.md) §3 — as a per-part indicator on the reference (RSC status is a per-part fact, not a per-prop column). The markdown endpoint (§9) carries the same per-part fact as a badge on the part heading (`### Part · RSC: client`); its prop table has no RSC column. _(Amended 2026-08-24: previously worded "RSC-status column"; 2026-09-02: the markdown endpoint aligned to per-part, [ADR 0009](../adr/0009-docs-client-boundaries.md).)_
- Generation failures (unresolvable type, missing JSDoc on a public prop) **fail the docs build** — no silent empty cells.
- **No docs-infra dependency.** `@mui/internal-docs-infra` (and its `typescript-api-extractor`) is neither installed nor vendored — it is 0.x-breaking-by-policy and peers TypeScript 6 against our TypeScript 7 toolchain. Only base-ui's _presentation patterns_ are ported (ruling 74b, 2026-08-24: MUI docs-infra is not a dependency; `@elmeragroup/internal` owns extraction, [ADR 0010](../adr/0010-internal-package-owns-extraction-and-lint.md)).

## 9 AI docs

- **`llms.txt`** at the site root: index of every docs page with one-line descriptions, generated at docs build. It has a Handbook page explaining the surface.
- **A markdown endpoint per component** (`/components/<name>.md` or equivalent): the component's API reference + demo source, generated from the **same API/demo sources** at docs build — one pipeline, three consumers (HTML docs, VR, AI). The component page's **View as Markdown** link points here.
- **`GET /api/themes`**: a JSON catalog of the 20 legal themes for AI and tooling. It is a **docs generate-pipeline artifact**, not a published `@elmeragroup/ui/theme` API — `composeTheme`, `TOKEN_NAMES`, and `PRIMITIVES` stay package-private. The catalog builder imports through the workspace-only `@elmeragroup/ui/theme-catalog` tooling entry (architecture.md §8). The generated Figma barrel is a typed const with no assertions.
- **No shadcn-style registry in v1.** The library is a packaged dependency, not copy-paste source; a registry is a roadmap note only if demand appears.

### 9.1 Theme catalog endpoint

`GET /api/themes` is emitted at docs build into `src/generated/theme-catalog.ts` and served as JSON. The envelope:

- **20 legal themes**, `legalThemeCount === 20`. Illegal slugs (`*-fkab-private`, `*-fkse-company`) are absent.
- Density is **locked to variant**: `internal` → `dense`, `external` → `comfortable`. The row's `attributes` stamp the three theme axes plus that density (`data-theme-variant`, `data-theme-brand`, `data-theme-segment`, `data-density`).
- Token keys are CSS custom-property names (`--primary`, …). Each theme's `tokens` map has the **77** themable role tokens ([theming](theming.md) §2.2).
- Values are CSS-honest `composeTheme` output, including `var(...)` aliases — never pre-resolved. `--brand` is `var(--brand-fkas)` on an `fkas` theme; `--destructive` is `var(--error)`; `--sidebar-brand` is `var(--brand)`.
- Brand primitives appear **once at the payload root** (`primitives["--brand-fkas"]`, `"--brand-fkab": "var(--brand-fkas)"`), not copied onto every theme.

### 9.2 Figma import files

Native Figma variable import takes **DTCG 2025.10 JSON, one file per mode** ([Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables)). Color space is sRGB (not OKLCH); dimensions are `px`; aliases are `{group.name}`.

- `GET /api/themes/figma` — index of the 20 legal slugs and their file URLs.
- `GET /api/themes/figma/<slug>` — one DTCG document for that theme (`application/design-tokens+json`). Illegal slugs 404.
- Drag the 20 slug files onto a **new** variable collection. Tokens present in every file become variables; each file is a mode. Density is omitted (not a theme axis). Primitives are inlined in every file so first-import aliases resolve without cross-collection IDs.

## 10 Hosting

- **Vercel** — first-class Next hosting.
- **Per-PR preview deploys** are required infrastructure, not a nicety: docs previews are the review surface for demo and component changes.
