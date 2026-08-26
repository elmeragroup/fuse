# Plan 003: Migrate the docs app's local CSS to Tailwind utilities

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 237acc7..HEAD -- apps/docs docs/spec/docs-site.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `237acc7`, 2026-08-26
- **Execution**: DONE — advisor-verified 2026-08-26 on
  `codex/003-docs-tailwind-migration` at `8cb92da`

## Why this matters

The docs app already runs Tailwind v4 and its demos already use utility classes, but the
docs chrome and generated-reference UI still carry 1,142 lines across 16 route/component
stylesheets (plus the 18-line global entry). That split makes styling conventions
inconsistent, keeps presentation coupled to PascalCase selector names, and has led
server/browser tests to use styling classes as DOM contracts. Move the docs-owned
presentation into statically discoverable Tailwind utility strings while preserving the
current visual dimensions, breakpoints, theme behavior,
accessibility behavior, and the library-generated comfortable-density overlay.

This is a styling-mechanism migration, not a redesign. Pixel values that encode the
accepted docs design stay unchanged unless Tailwind has an exactly equivalent named
utility. The finished app has one docs-owned CSS entry (`src/styles/globals.css`) for
Tailwind/library imports, source declarations, and docs design tokens; it has no local
component or route stylesheet.

## Current state

### Framework and build

- `apps/docs` is a private Next 16 App Router app using React 19, TypeScript 7, MDX, and
  Tailwind 4 through `@tailwindcss/postcss` (`apps/docs/package.json`,
  `apps/docs/postcss.config.mjs:1-8`). No new dependency is required.
- The workspace uses pnpm 11 and Turbo. The exact docs commands are in
  `apps/docs/package.json:5-12`; docs tests expect a production build because
  `apps/docs/turbo.json:26-29` makes `test` depend on `build`.
- Root formatting is oxfmt. `.oxfmtrc.json:13-16` points Tailwind sorting at
  `packages/ui/src/styles/ui.css` and recognizes `tv`/`cn`. Do not change that normative
  library setting for this app migration.

### Existing Tailwind entry

`apps/docs/src/styles/globals.css:1-18` already imports Tailwind and the library source,
and already scans both the library and docs source trees:

```css
@import "tailwindcss";
@import "@elmeragroup/ui/css";
@import "@elmeragroup/ui/themes.css";
@source "../../../../packages/ui/src";
@source "../../src";

html,
body {
  background: var(--background);
  color: var(--foreground);
}

body {
  margin: 0;
}
```

The first three imports and both `@source` declarations are load-bearing. Tailwind scans
utility strings in `apps/docs/src`, including complete literal strings stored in TypeScript
constants. Never construct a Tailwind class name from dynamic fragments.

### Stylesheet inventory and ownership

There are 16 docs-owned component/route stylesheets plus `globals.css`:

| Stylesheet                              | Lines | React owner(s)                                          |
| --------------------------------------- | ----: | ------------------------------------------------------- |
| `src/app/(docs)/layout.css`             |    98 | `docs-shell.tsx`, `(docs)/page.tsx`, shared page chrome |
| `src/components/api-reference.css`      |   312 | `api-reference.tsx`, `api-prop-rows.tsx`                |
| `src/components/bundle-sizes.css`       |    13 | `bundle-sizes.tsx`                                      |
| `src/components/component-sections.css` |    50 | `component-intro.tsx`, `prose.tsx`, `api-reference.tsx` |
| `src/components/demo-frame.css`         |    84 | `demo-frame.tsx`, `demo-stage.tsx`                      |
| `src/components/docs-page.css`          |   112 | `docs-page.tsx` and shared tables                       |
| `src/components/header.css`             |    67 | `header.tsx`, `theme-picker.tsx`                        |
| `src/components/mdx-elements.css`       |    25 | `mdx-elements.tsx`                                      |
| `src/components/meta-links.css`         |    19 | `meta-links.tsx`                                        |
| `src/components/quick-nav.css`          |    52 | `quick-nav.tsx`                                         |
| `src/components/search-palette.css`     |   107 | `search-palette.tsx`                                    |
| `src/components/side-nav.css`           |    67 | `side-nav.tsx`                                          |
| `src/components/skip-nav.css`           |    34 | `skip-nav.tsx`                                          |
| `src/components/theme-matrix.css`       |    48 | `theme-matrix.tsx`                                      |
| `src/components/token-swatch-list.css`  |    41 | `token-swatch-list.tsx`                                 |
| `src/components/tokens-consumed.css`    |    13 | `tokens-consumed.tsx`                                   |

The migration deletes all 16 rows above. `apps/docs/src/styles/globals.css` remains.

### Accepted design values

`apps/docs/src/app/(docs)/layout.css:1-9` is the current local palette/typography contract:

```css
:root {
  --docs-ink: #1a1b1e;
  --docs-sub: #6b7078;
  --docs-line: #e8e9eb;
  --docs-soft: #f6f7f8;
  --docs-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --docs-code-bg: #fbfbfc;
  --docs-header-height: 56px;
}
```

Other CSS adds the body-copy color `#3f434a`, required marker `#b3261e`, and the
server-safe RSC badge colors `#3f6b4a` / `#cfe3d5` / `#f4faf6`. Preserve those as
docs-local Tailwind theme values; do not replace them with brand-varying semantic tokens.
The docs chrome is deliberately light-only (`docs/spec/docs-site.md:10`, `68-73`).

### Existing utility convention

Docs demos already put complete Tailwind strings directly on elements. For example,
`apps/docs/src/app/(docs)/components/scroll-area/demos/scroll-area-vertical.tsx:9-15`:

```tsx
<ScrollArea.Root className="h-72 rounded-md border">
  <div className="p-4">
    <h4 className="text-sm font-medium mb-4">Tags</h4>
    <ul className="flex flex-col gap-2">
```

Match that model. For a complex multi-slot component, a local `const classNames = { ... }
as const` map is allowed to keep JSX readable. Shared, identical docs primitives may use
complete literal constants from the new `src/components/docs-styles.ts`. Do not add
CSS Modules, `@apply`, a CSS-in-JS runtime, `tailwind-variants`, `clsx`, or a new `cn`
dependency for this migration.

### Load-bearing exceptions and test coupling

- `apps/docs/src/components/demo-frame.css:1` imports
  `@elmeragroup/ui/demo-stage-comfortable.css`. The package generates that artifact with
  the selector `.DemoStage[data-density="comfortable"]`
  (`packages/ui/src/theme/generate-demo-stage-css.ts:4`). Move the import to
  `globals.css`; do **not** translate or copy its `--control-*` declarations. Keep the
  literal `DemoStage` marker class on the `ThemeScope` in `demo-stage.tsx` in addition to
  Tailwind utilities.
- `apps/docs/src/components/api-reference.css:64-71,253-311` uses
  `content-visibility`, a row-count-based intrinsic height, three responsive column
  shapes, subgrid, and `::details-content`. These are behaviorally important layout
  mechanics, not optional decoration.
- Several tests currently assert styling class names: `document-html.test.ts:43-62`,
  `component-page.test.ts:18-71`, `handbook.test.ts:21-45`, and
  `first-paint.browser.test.ts:250-355`. Replace those contracts with roles, element
  semantics, or named `data-*` hooks. `.DemoStage` is the sole class-name exception
  because generated library CSS consumes it.
- `demo-stage-density.test.ts:8-25` reads `demo-frame.css`; it must read
  `src/styles/globals.css` after the import moves.

## Commands you will need

| Purpose                   | Command                            | Expected on success                                      |
| ------------------------- | ---------------------------------- | -------------------------------------------------------- |
| Confirm runtime           | `node --version && pnpm --version` | Node 24.x and pnpm 11.x                                  |
| Generate + typecheck docs | `pnpm --filter docs type-check`    | exit 0; Next typegen and `tsc --noEmit` report no errors |
| Production build          | `pnpm --filter docs build`         | exit 0; all docs routes compile                          |
| Docs tests                | `pnpm --filter docs test`          | exit 0; all Vitest/Playwright tests pass after the build |
| Lint                      | `pnpm lint`                        | exit 0 with no warnings                                  |
| Format                    | `pnpm format:check`                | exit 0                                                   |
| Full local merge gate     | `pnpm ci:checks`                   | exit 0                                                   |

No install command or manifest edit should be needed. If an executor starts from a clean
checkout without dependencies, use the repository-standard `pnpm install --frozen-lockfile`
before the table above; it must not change `pnpm-lock.yaml`.

## Scope

**In scope** (the only source/spec files you should modify or create):

- Tailwind entry and route roots:
  - `apps/docs/src/styles/globals.css`
  - `apps/docs/src/app/(docs)/layout.tsx`
  - `apps/docs/src/app/(private)/layout.tsx`
  - `apps/docs/src/app/(website)/layout.tsx`
  - `apps/docs/src/app/(docs)/page.tsx`
- Shared docs style constants (create):
  - `apps/docs/src/components/docs-styles.ts`
- Components that own the migrated selectors:
  - `apps/docs/src/components/api-prop-rows.tsx`
  - `apps/docs/src/components/api-reference.tsx`
  - `apps/docs/src/components/bundle-sizes.tsx`
  - `apps/docs/src/components/component-intro.tsx`
  - `apps/docs/src/components/demo-frame.tsx`
  - `apps/docs/src/components/demo-stage.tsx`
  - `apps/docs/src/components/docs-page.tsx`
  - `apps/docs/src/components/docs-shell.tsx`
  - `apps/docs/src/components/document-root.tsx`
  - `apps/docs/src/components/header.tsx`
  - `apps/docs/src/components/inline-code.tsx`
  - `apps/docs/src/components/mdx-elements.tsx`
  - `apps/docs/src/components/meta-links.tsx`
  - `apps/docs/src/components/prose.tsx`
  - `apps/docs/src/components/quick-nav.tsx`
  - `apps/docs/src/components/search-palette.tsx`
  - `apps/docs/src/components/side-nav.tsx`
  - `apps/docs/src/components/skip-nav.tsx`
  - `apps/docs/src/components/theme-matrix.tsx`
  - `apps/docs/src/components/theme-picker.tsx`
  - `apps/docs/src/components/token-swatch-list.tsx`
  - `apps/docs/src/components/tokens-consumed.tsx`
- Pages that currently consume the stylesheet-defined lede/list/table/mono classes:
  - `apps/docs/src/app/(docs)/accessibility/page.tsx`
  - `apps/docs/src/app/(docs)/handbook/brands-and-segments/page.tsx`
  - `apps/docs/src/app/(docs)/handbook/localization/page.tsx`
- Tests whose selectors or stylesheet path change, plus one new migration contract test:
  - `apps/docs/test/api-panel.browser.test.ts`
  - `apps/docs/test/component-page.test.ts`
  - `apps/docs/test/demo-stage-density.test.ts`
  - `apps/docs/test/document-html.test.ts`
  - `apps/docs/test/first-paint.browser.test.ts`
  - `apps/docs/test/handbook.test.ts`
  - `apps/docs/test/docs-tailwind.test.ts` (create)
  - `apps/docs/test/workspace-css.test.ts` (formatter-only scope amendment: the two
    pre-existing 111/115-column assertions fail the required whole-repo oxfmt gate)
- Normative docs convention:
  - `docs/spec/docs-site.md`
- Delete these files after their selectors have been translated:
  - `apps/docs/src/app/(docs)/layout.css`
  - `apps/docs/src/components/api-reference.css`
  - `apps/docs/src/components/bundle-sizes.css`
  - `apps/docs/src/components/component-sections.css`
  - `apps/docs/src/components/demo-frame.css`
  - `apps/docs/src/components/docs-page.css`
  - `apps/docs/src/components/header.css`
  - `apps/docs/src/components/mdx-elements.css`
  - `apps/docs/src/components/meta-links.css`
  - `apps/docs/src/components/quick-nav.css`
  - `apps/docs/src/components/search-palette.css`
  - `apps/docs/src/components/side-nav.css`
  - `apps/docs/src/components/skip-nav.css`
  - `apps/docs/src/components/theme-matrix.css`
  - `apps/docs/src/components/token-swatch-list.css`
  - `apps/docs/src/components/tokens-consumed.css`

**Out of scope** (do NOT touch, even though they look related):

- `packages/ui/**` — especially `ui.css`, the Tailwind formatter source, and the generated
  `demo-stage-comfortable.css` pipeline. This task consumes those contracts; it does not
  change them.
- `apps/docs/postcss.config.mjs`, `apps/docs/package.json`, root `package.json`,
  `pnpm-workspace.yaml`, and `pnpm-lock.yaml` — Tailwind is already configured.
- `apps/docs/src/app/(docs)/components/**/demos/**` — demos already use Tailwind and are
  not part of the legacy CSS inventory.
- `apps/docs/src/generated/**`, committed `api.json` files, `apps/docs/public/**`, and
  generator output. A normal verification run may regenerate them, but the final diff
  must contain no unrelated generated drift.
- The visual design, information architecture, theme behavior, or component API. Do not
  opportunistically restyle, rename text, change routes, or alter component behavior.
- Adding Tailwind Typography or any other dependency.
- Rewriting `@elmeragroup/ui/demo-stage-comfortable.css` as utilities or inline variables.

## Git workflow

- Branch: `codex/003-docs-tailwind-migration`
- Use conventional commits, matching recent repository history. Recommended commit:
  `refactor(docs): migrate local styles to Tailwind`
- This is a private docs-app/internal-doc change; do not add a package changeset. A PR
  needs the repository's `no-changeset` label for the workflow gate.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Establish the Tailwind-only docs style entry

Edit `apps/docs/src/styles/globals.css` so it contains, in this order:

1. The existing Tailwind, `@elmeragroup/ui/css`, and themes imports.
2. `@import "@elmeragroup/ui/demo-stage-comfortable.css";`, moved unchanged from
   `demo-frame.css`.
3. The existing two `@source` declarations and their explanatory comment.
4. A Tailwind `@theme` block for the accepted docs-local values:

```css
@theme {
  --color-docs-ink: #1a1b1e;
  --color-docs-body: #3f434a;
  --color-docs-sub: #6b7078;
  --color-docs-line: #e8e9eb;
  --color-docs-soft: #f6f7f8;
  --color-docs-code: #fbfbfc;
  --color-docs-required: #b3261e;
  --color-docs-rsc: #3f6b4a;
  --color-docs-rsc-line: #cfe3d5;
  --color-docs-rsc-soft: #f4faf6;
  --font-docs-sans: -apple-system, "Segoe UI", system-ui, sans-serif;
  --font-docs-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --spacing-docs-header: 3.5rem;
}
```

Remove the `html`, `body`, and `body` selectors from `globals.css`; their declarations
move to JSX utilities in step 2. Do not add `@apply` or new ordinary selectors.

Create `apps/docs/src/components/docs-styles.ts` containing complete, static Tailwind
strings for only the styles shared across multiple owners:

- docs lede (including its descendant inline-code treatment),
- inline code,
- section heading,
- table wrapper/table/header cell/body cell/numeric cell,
- docs mono text.

Use named exports ending in `ClassName`. Keep every utility token literal in the source;
for example, export one complete `"font-docs-mono ..."` string, never construct
`text-${size}` or concatenate utility fragments based on runtime values.

The exact values to preserve come from `layout.css:38-82`,
`docs-page.css:48-112`, and `component-sections.css:42-50`. The shared section heading is
`text-[1.15rem] font-[650] tracking-[-0.01em]`, with `mt-12 mb-[0.9rem]`, `border-t`,
`pt-6`, and `scroll-mt-[calc(var(--spacing-docs-header)+1rem)]`.

**Verify**: `pnpm --filter docs build` → exit 0. At this intermediate point old CSS may
still exist, but the new `@theme` utilities and generated density import must compile.

### Step 2: Translate the document roots, shell, header, and navigation

Move the global/layout declarations into the elements that own them:

- `document-root.tsx`: give `<html>` `bg-background text-foreground` so the theme-backed
  no-JavaScript canvas remains on the document root.
- `(docs)/layout.tsx`: remove `./layout.css`; give `<body>`
  `m-0 min-w-80 bg-background font-docs-sans text-docs-ink antialiased`.
- Reserved route layouts: keep importing `globals.css`; give each `<body>`
  `m-0 bg-background text-foreground`. Do not add providers or docs chrome to them.
- `docs-shell.tsx`:
  - root: `min-h-dvh bg-background text-docs-ink` and `data-docs-root`;
  - columns: `mx-auto grid max-w-[1200px] grid-cols-1`, then
    `min-[45rem]:grid-cols-[240px_minmax(0,1fr)]` and
    `min-[60rem]:grid-cols-[240px_minmax(0,1fr)_180px]`;
  - main: `w-full min-w-0 max-w-[720px] px-6 pt-10 pb-24 min-[45rem]:px-12`, plus
    descendant `h1` utilities preserving 2rem/650/-0.02em/0.6rem-bottom values.
- `(docs)/page.tsx`: replace `DocsLede`, `DocsGroupHeading`, and `DocsList` with utilities
  or the shared lede constant. Preserve 0.72rem group headings, current list spacing, and
  link hover colors.

Translate `header.tsx` and `theme-picker.tsx` from `header.css`:

- Header stays 56px high, sticky at top with z-index 10, a 1px docs-line border,
  `bg-white/[92%]`, `backdrop-blur-[8px]`, 1.5rem gap, and 1.5rem inline padding.
- Wordmark keeps 0.95rem/650/-0.01em and focus-visible outline; use a descendant variant
  for its `<span>` (`[&_span]:...`).
- Picker stays `ml-auto flex items-center`. Put the common select styles and
  `first-child`, adjacent-sibling, `last-child`, and `focus-visible` rules on the picker
  parent with arbitrary descendant variants such as `[&_select]:...`,
  `[&_select:first-child]:...`, and `[&_select+select]:border-l-0`. Keep the exact 11.5px
  mono type and 5px/9px padding.

Translate both nav components:

- Side nav: preserve the 45rem transition from a short 12rem-high mobile scroller to a
  sticky `calc(100vh - 56px)` column. Use `data-active:` for its existing `data-active`
  state and keep `aria-current` unchanged.
- Quick nav: remain hidden below 60rem; at 60rem it is a sticky block with the current
  height/padding/type. Do not switch to the library Sidebar.
- Skip nav: reproduce the current visually-hidden base and focus-visible restoration
  using Tailwind (`absolute`, size-px, clip/clip-path arbitrary properties, and
  `focus-visible:*` utilities). Verify focus restores a 56px-high visible link at the
  upper-left with z-index 20. Do not rely on a bare `not-sr-only` if it overrides the
  explicit focused positioning; use explicit utilities when in doubt.

Remove the four component CSS imports as their translations land, but do not delete the
stylesheets until step 7.

**Verify**: `pnpm --filter docs type-check` → exit 0. Then run
`pnpm --filter docs build && pnpm --filter docs test` → exit 0; reserved roots still have
brand/density and no docs provider/picker/bootstrap.

### Step 3: Translate prose, code, tables, and shared component-page sections

Use the shared constants from `docs-styles.ts` to replace selectors from
`docs-page.css`, `component-sections.css`, `mdx-elements.css`, `meta-links.css`, and
`bundle-sizes.css`:

- `docs-page.tsx`: apply the lede class and put scoped descendant utilities on the prose
  wrapper for `h2`, `h3`, `p`, `ul`, `ol`, `li`, `strong`, `a`, `code`, `pre`, and
  `pre code`. Preserve every current size, margin, padding, color, underline offset,
  border, radius, overflow, and line-height value. Do not install Tailwind Typography.
- `prose.tsx`: similarly scope only authored component-page prose. Preserve the current
  1.4rem top margin, 0.9rem/1.65 body, and scroll-margin behavior for `h2`/`h3`; do not
  leak those selectors into generated API/token sections.
- `inline-code.tsx`: put the shared inline-code class directly on the `<code>` it creates.
- `mdx-elements.tsx`: preserve incoming `className`, but prepend a complete static
  Tailwind block class for fenced `<pre>` elements. Express the descendant `code` and
  `.sh__line` rules as arbitrary descendant variants. Inline MDX code gets the shared
  inline-code class; language code inside a fenced block must not get the inline pill.
- `component-intro.tsx`: apply lede/import/RSC-pill utilities directly; keep the import
  code pill distinct from prose inline code.
- `meta-links.tsx`: use parent descendant utilities for its two anchors and hover state.
- `api-reference.tsx` and `tokens-consumed.tsx`: import the shared section-heading class
  rather than duplicating the same utility sequence.
- `bundle-sizes.tsx` and the accessibility/brands/localization pages: replace
  `DocsTableWrap`, `DocsTable`, `DocsNum`, and `DocsMono` with the shared table/mono
  constants. Apply cell classes on the actual `th`/`td` elements so numeric cells can
  reliably override right padding/alignment without selector-specificity tricks.

Keep syntax-highlighter variables (`--sh-*`) as the library contract. `text-sh-identifier`
or an exact arbitrary fallback is acceptable as long as the production build and
highlighted-source tests pass.

**Verify**: `pnpm --filter docs type-check` → exit 0, then
`pnpm --filter docs build && pnpm --filter docs test` → exit 0. Component pages must still
render authored prose, highlighted code, tables, and all generated sections.

### Step 4: Translate demo, search, matrix, and token UI

Translate the remaining straightforward component styles with local literal class maps
where that makes the JSX readable:

- `demo-frame.tsx` / `demo-stage.tsx`:
  - section and heading retain the current margins, border, and scroll offset;
  - frame card retains 10px radius, 1px docs-line border, and clipping;
  - the stage retains 2.8rem/2rem padding, centered wrapping flex layout, theme
    `background`/`foreground`, and the exact 18px radial-dot pattern using arbitrary
    `background-image` and `background-size` utilities;
  - source/meta regions retain current mono sizes, borders, padding, overflow, and colors;
  - keep `DemoStage` as a non-presentation marker class and add `data-demo-stage`;
  - add stable `data-demo-frame`, `data-demo-slug`, `data-demo-density`, and
    `data-demo-source` hooks where the tests need them;
  - update the comment in `demo-stage.tsx:21-24` to name `globals.css`, not the deleted
    `demo-frame.css`.
- `search-palette.tsx`: merge the existing partial Tailwind string on `Dialog.Content`
  with the translated local chrome. Use `sr-only` for the dialog title, `placeholder:`
  and `focus:` variants for the input, and `data-active:` for active options. Preserve
  dialog positioning/width and all keyboard/ARIA behavior.
- `theme-matrix.tsx`: move the grid, cell, slug, surface, and row declarations to
  utilities. Add `data-theme-matrix`, `data-theme-matrix-cell`, and `data-theme-slug`
  hooks for server-HTML tests; do not add a density axis.
- `token-swatch-list.tsx`: move layout/typography to utilities, keep the dynamic
  `style={{ background: `var(${token.name})` }}` because runtime token names cannot be
  encoded as static Tailwind utilities, and express the empty swatch's repeating gradient
  as one complete arbitrary background utility. Add `data-token-swatch` to both swatch
  branches.

Dynamic inline style is allowed only for the token swatch's runtime custom-property name
and the existing `--api-rows` count. Do not move static presentation into new style
objects.

**Verify**: `pnpm --filter docs build && pnpm --filter docs test` → exit 0. The picker
must still change only demo scopes; external preview must still retarget the stage to
comfortable density while the document remains dense.

### Step 5: Rebuild the API reference layout with Tailwind arbitrary utilities

Treat `api-reference.css` as a mechanical translation. Preserve the DOM and interaction
logic in `api-prop-rows.tsx`; replace only classes and test hooks.

Use these exact Tailwind shapes (split into complete local constants if desired):

- Rows root:
  `grid grid-cols-[var(--api-cols)] rounded-[10px] border border-docs-line`
  with `[--api-cols:minmax(0,1fr)]`, `[content-visibility:auto]`, and
  `[contain-intrinsic-height:auto_calc((var(--api-rows,8)+1)*(2.5rem+1px)-1px)]`.
- Responsive columns:
  `min-[34rem]:[--api-cols:11rem_minmax(0,1fr)_2.5rem]` and
  `min-[52rem]:[--api-cols:5fr_7fr_4fr_2.5rem]`.
- Every element in the existing 34rem subgrid chain (header row, `details`, `summary`,
  `details::details-content`, panel, `dl`, item) must receive the equivalent of
  `min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid
min-[34rem]:items-center`. Express `::details-content` with an arbitrary pseudo-element
  variant on `details`; do not drop it.
- The Type cell is `hidden min-[34rem]:block`. The Default cell is
  `hidden min-[52rem]:block`.
- Mark each `details` as `group` and use `group-open:rotate-180` on the chevron. Keep the
  120ms ease transition and `motion-reduce:transition-none`.
- Hide the native WebKit marker with `[&::-webkit-details-marker]:hidden`.
- Preserve the existing 2.5rem minimum row height, focus/hover treatments, dashed panel
  divider, narrow flex panel, 34rem aligned definition-list panel, and 52rem Default
  column.

Do not replace the subgrid with duplicated fixed grids; the current one-source column
contract is intentional (`api-reference.css:1-11`). Keep the existing
`style={{ "--api-rows": props.length } as CSSProperties}` and its safety comment.

Expand `apps/docs/test/api-panel.browser.test.ts` so one browser test covers all three
responsive modes by checking computed visibility of Prop/Type/Default header cells at
viewports below 34rem, between 34rem and 52rem, and above 52rem. Retain the current
expanded-panel width assertion at desktop size and update its comment so it no longer
references the deleted CSS filename.

**Verify**: `pnpm --filter docs build && pnpm --filter docs test -- api-panel.browser.test.ts`
→ exit 0; all responsive visibility assertions pass and the expanded panel remains at
least 90% of its row width with less than 4px difference.

### Step 6: Decouple tests from presentation classes

Update tests to assert stable structure rather than the class strings Tailwind owns:

- `document-html.test.ts`: use `data-docs-root` instead of the `DocsRoot` string.
- `component-page.test.ts`: count `data-demo-frame`, use the demo data hooks, use native
  `details`/`summary` plus current ids/ARIA for API rows, and use `data-token-swatch`.
  Do not assert Tailwind utility strings.
- `handbook.test.ts`: slice/count the matrix with `data-theme-matrix`,
  `data-theme-matrix-cell`, and `data-theme-slug`.
- `first-paint.browser.test.ts`: keep `.DemoStage` for the generated density selector,
  but use the named data hooks for the slug and density labels.
- `demo-stage-density.test.ts`: read `src/styles/globals.css`; assert the generated
  artifact import exists there and no `--control-*` declarations were copied. Keep the
  artifact and PostCSS negative checks.

Create `apps/docs/test/docs-tailwind.test.ts` as a small static migration contract:

1. Recursively enumerate `apps/docs/src/**/*.css` and assert the sorted result is exactly
   `src/styles/globals.css`.
2. Assert `globals.css` contains all four required imports and both `@source` lines.
3. Assert `globals.css` contains no `@apply` and no copied `--control-*` declaration.
4. Assert `demo-stage.tsx` still contains the literal `DemoStage` marker.

Use Node `fs`/`path` APIs already used throughout `apps/docs/test`; do not add a glob
dependency.

**Verify**: `pnpm --filter docs build && pnpm --filter docs test` → exit 0; all updated
tests pass without matching PascalCase styling classes other than `.DemoStage`.

### Step 7: Delete legacy CSS and record the convention

Delete all 16 CSS files listed in Scope and remove their side-effect imports. Do not delete
`src/styles/globals.css`, and do not remove its import from any route-group layout.

Amend `docs/spec/docs-site.md` in the Stack or Visual design section with the implemented
rule:

- docs chrome and authored docs surfaces use statically discoverable Tailwind v4 utility
  strings;
- `apps/docs/src/styles/globals.css` is the only docs-owned stylesheet and is limited to
  Tailwind/library imports, `@source`, and docs-local `@theme` tokens;
- component CSS and `@apply` are not used;
- `DemoStage` remains the required selector hook for the generated library density
  artifact, not a docs-owned component stylesheet.

Run the CSS inventory:

```sh
rg --files apps/docs/src -g '*.css'
```

**Expected output**: exactly `apps/docs/src/styles/globals.css`.

Also run:

```sh
rg -n 'layout\.css|api-reference\.css|bundle-sizes\.css|component-sections\.css|demo-frame\.css|docs-page\.css|header\.css|mdx-elements\.css|meta-links\.css|quick-nav\.css|search-palette\.css|side-nav\.css|skip-nav\.css|theme-matrix\.css|token-swatch-list\.css|tokens-consumed\.css' apps/docs docs/spec
```

**Expected output**: no stale source/spec references. References inside this plan do not
count because the command intentionally excludes `plans/`.

### Step 8: Run the full verification gate and inspect scope

Run, in order:

1. `pnpm format` — format only the in-scope edits; inspect the diff afterward because
   this command may format other dirty files if the operator had unrelated work.
2. `pnpm --filter docs type-check`
3. `pnpm --filter docs build`
4. `pnpm --filter docs test`
5. `pnpm lint`
6. `pnpm format:check`
7. `pnpm ci:checks`

All commands must exit 0. Then run `git status --short` and `git diff --stat`. Revert no
user work. The final diff must be limited to the in-scope files, the 16 deletions, the new
style/test files, the formatter-only `workspace-css.test.ts` amendment above, and the
executor's status update in `plans/README.md`. Generated files that changed only because
`generate` ran must either be intentionally explained or left unchanged; do not commit
incidental generator churn.

## Test plan

- Static migration contract in `apps/docs/test/docs-tailwind.test.ts`:
  - exactly one docs-owned CSS file remains;
  - the Tailwind/library/density import chain and both source scans remain;
  - no `@apply` and no copied density variables;
  - `.DemoStage` marker survives.
- Existing production-HTML coverage, updated to semantic/data hooks:
  - docs vs reserved-root composition and bootstrap order;
  - component page anatomy, five Button demos, API rows, and token swatches;
  - 20 legal theme-matrix cells and no density axis.
- Existing Playwright coverage:
  - fixed document theme vs preview scope;
  - dense/comfortable demo metrics;
  - search dialog keyboard/focus behavior;
  - expanded API panel spans the row.
- Expanded `api-panel.browser.test.ts` coverage:
  - below 34rem: Prop only;
  - 34rem–51.999rem: Prop + Type;
  - at/above 52rem: Prop + Type + Default;
  - expanded panel stays full-width.
- Build/type/lint/format gates verify that every arbitrary utility is accepted and emitted
  by Tailwind v4. This is especially important for radial/repeating gradients,
  `contain-intrinsic-height`, subgrid, and `::details-content`.

## Done criteria

ALL must hold:

- [ ] `rg --files apps/docs/src -g '*.css'` prints only
      `apps/docs/src/styles/globals.css`.
- [ ] `globals.css` imports Tailwind, `@elmeragroup/ui/css`, themes, and the generated
      demo-stage comfortable artifact, and retains both source scans.
- [ ] `globals.css` contains no `@apply`, ordinary component selectors, or copied
      `--control-*` declarations.
- [ ] All former CSS side-effect imports are removed; only the three route layouts import
      `../../styles/globals.css` as executable app CSS.
- [ ] `.DemoStage[data-density="comfortable"]` still receives the library-generated
      comfortable variables; the literal `DemoStage` marker remains on the preview scope.
- [ ] At 45rem/60rem the docs shell still changes from one to two to three columns, and the
      QuickNav appears only at 60rem.
- [ ] API reference column visibility and expanded-panel width pass at all three specified
      breakpoints.
- [ ] Tests use semantic selectors or named data hooks, not migrated styling utility
      strings; `.DemoStage` is the documented exception.
- [ ] `pnpm --filter docs type-check` exits 0.
- [ ] `pnpm --filter docs build` exits 0.
- [ ] `pnpm --filter docs test` exits 0.
- [ ] `pnpm lint` exits 0 with no warnings.
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm ci:checks` exits 0.
- [ ] No dependency manifest, lockfile, `packages/ui/**`, generated docs artifact, or demo
      file is modified.
- [ ] `plans/README.md` marks plan 003 DONE (or BLOCKED with a one-line reason).

## STOP conditions

Stop and report back (do not improvise) if:

- Tailwind/PostCSS no longer matches `apps/docs/package.json` and
  `apps/docs/postcss.config.mjs`, or completing the work appears to require a dependency or
  lockfile change.
- The generated density artifact no longer targets
  `.DemoStage[data-density="comfortable"]`, or importing it from `globals.css` changes the
  computed dense/comfortable metrics.
- Tailwind v4 cannot express `::details-content`, subgrid, the intrinsic-size expression,
  or one of the exact gradients with a static arbitrary utility. Report the exact class
  and compiler output; do not silently retain a component stylesheet or replace the
  layout mechanism.
- The current CSS values/breakpoints materially differ from the excerpts above.
- Preserving appearance requires changing a published `@elmeragroup/ui` token, component,
  or generated CSS artifact.
- Any verification step fails twice after a reasonable in-scope correction.
- The migration exposes an unrelated application behavior bug. Record it separately; do
  not expand this styling migration into a behavior refactor.

## Maintenance notes

- Future docs UI should use static Tailwind utilities and the docs `@theme` values. Keep
  shared literal constants small and semantic; do not rebuild a stylesheet as an opaque
  TypeScript class dictionary.
- Review arbitrary selector utilities carefully. They must remain statically visible to
  Tailwind, scoped to the component that owns the DOM, and covered by the production build.
- The `DemoStage` class is not legacy styling debt. It is a cross-package selector contract
  named by `generate-demo-stage-css.ts` and the normative docs/theming specs.
- API reference subgrid and `::details-content` are easy to regress during class cleanup.
  Keep the three-breakpoint and panel-width browser assertions.
- No screenshot baseline exists in this repository. The computed-layout browser tests are
  the machine-checkable visual safety net for this migration; any later visual-regression
  system should include the docs shell, API table, demo frame, search palette, and matrix.
