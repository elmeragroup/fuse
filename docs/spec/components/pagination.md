# Pagination

## 1 Header

- **Canonical name**: `Pagination` — namespace compound: `Pagination.Root`, `Pagination.Content`, `Pagination.Item`, `Pagination.Link`, `Pagination.Previous`, `Pagination.Next`, `Pagination.Ellipsis`
- **Export path**: `@elmeragroup/ui` (`import { Pagination } from "@elmeragroup/ui"`)
- **Tier**: plain-element composite (no base-ui primitive; anchors styled via borrowed `buttonVariants`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/pagination.tsx` + `.ref/…/src/styles/paginaton.ts` (ref filename is typo'd; ours is `styles/pagination.ts`)

## 2 Anatomy

| Part | Renders | data-slot |
| --- | --- | --- |
| `Pagination.Root` | `<nav role="navigation" aria-label="pagination">` | `pagination` |
| `Pagination.Content` | `<ul>` | `pagination-content` |
| `Pagination.Item` | `<li>` | `pagination-item` |
| `Pagination.Link` | `<a>` styled via `buttonVariants` | `pagination-link` |
| `Pagination.Previous` | `Pagination.Link` (`size="default"`) with `<CaretLeft />` + text | `pagination-previous` |
| `Pagination.Next` | `Pagination.Link` (`size="default"`) with text + `<CaretRight />` | `pagination-next` |
| `Pagination.Ellipsis` | `<span aria-hidden>` with `<DotsThree />` + sr-only "More pages" | `pagination-ellipsis` |

```tsx
<Pagination.Root>
  <Pagination.Content>
    <Pagination.Item><Pagination.Previous href="#" text="Forrige" /></Pagination.Item>
    <Pagination.Item><Pagination.Link href="#" isActive>1</Pagination.Link></Pagination.Item>
    <Pagination.Item><Pagination.Link href="#">2</Pagination.Link></Pagination.Item>
    <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
    <Pagination.Item><Pagination.Next href="#" text="Neste" /></Pagination.Item>
  </Pagination.Content>
</Pagination.Root>
```

## 3 Props

All parts are plain functions (no `forwardRef`; React 19 `ref` flows as a prop). `className` merged via `cn`.

| Part | Type | Notes |
| --- | --- | --- |
| `Pagination.Root` | `ComponentProps<"nav">` | `role="navigation" aria-label="pagination"` baked in; label overridable via spread for i18n |
| `Pagination.Content` | `ComponentProps<"ul">` | `flex flex-row items-center gap-1` |
| `Pagination.Item` | `ComponentProps<"li">` | structural only |
| `Pagination.Link` | `{ isActive?: boolean } & Pick<ButtonProps, "size"> & ComponentProps<"a">` | `size` default `"icon"`; see mapping below |
| `Pagination.Previous` | `ComponentProps<typeof Pagination.Link> & { text: string }` | **`text` REQUIRED** — no baked-in English; i18n string injected by the consumer. `aria-label="Go to previous page"` baked in, overridable |
| `Pagination.Next` | same as Previous | `aria-label="Go to next page"` baked in, overridable |
| `Pagination.Ellipsis` | `ComponentProps<"span">` | not interactive |

**`isActive` → button-variant mapping**: `Pagination.Link` renders `buttonVariants({ variant: isActive ? "outline" : "ghost", size })` — the current page reads as an outlined button, all other pages as ghost buttons. `isActive` also drives `aria-current="page"` via the `isActive ? "page" : undefined` idiom.

## 4 Variants

**Recipe: `paginationVariants` — PUBLIC**, exported from `styles/pagination.ts` via the `./styles` barrel (borrowed-style precedent: it composes the public `buttonVariants`, so consumers rebuilding pager links need both).

Slots: `base` (`mx-auto flex w-full flex-col items-center justify-center space-y-4`), `content` (`flex flex-row items-center gap-1`), `link` (`gap-1`), `linkIcon` (`size-4`), `ellipsis` (`flex size-9 items-center justify-center`), `ellipsisIcon` (`size-4`).

Axis `direction`: `previous` → `link: "pl-2.5"`; `next` → `link: "pr-2.5"` (asymmetric padding so the chevron side sits tighter). No defaults.

The heavy lifting (colors, radius, focus ring, sizing) comes from the **borrowed public `buttonVariants`** (`variant: "outline" | "ghost"`, `size: "icon" | "default"`); `paginationVariants` only adds layout.

## 5 Consumed tokens

Via borrowed `buttonVariants`: `background`, `accent`, `accent-foreground`, `input`/border, `ring` (see button spec §5). Pagination-local slots consume no color tokens — layout classes only.

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2 (added by us — see §8.5). No state attributes beyond `aria-current` on the active link.

**Consumed**: none — no group/peer scopes.

## 7 Accessibility

- Root is a `<nav role="navigation" aria-label="pagination">` landmark; pages are list items inside a `<ul>`.
- Current page: `aria-current="page"` on the active `Pagination.Link` (the `x || undefined` idiom — never `"false"`).
- Previous/Next carry `aria-label`s ("Go to previous/next page") plus visible injected `text`; consumers localize both (spread overrides the label).
- Ellipsis: `aria-hidden` wrapper with sr-only "More pages" text; not focusable.
- Links are ordinary anchors — native keyboard/focus semantics; focus ring comes from `buttonVariants`. Use `href`-less handling (or `render` a router link via anchor props) at the consumer level; disabled states are modeled by omitting the link, not `aria-disabled`.

## 8 Divergence from reference (FULL CLEANUP — user-ruled)

1. **Rename: flat → namespace** — ref exports `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`; ours are `Pagination.Root/.Content/.Item/.Link/.Previous/.Next/.Ellipsis`.
2. **`forwardRef` dropped** — ref wraps `Content` and `Item` in `React.forwardRef` (and only those two); React 19 makes `ref` a plain prop, so all parts are plain functions. `displayName` assignments dropped with it.
3. **react-aria `Span` → plain `<span>`** — ref renders `Previous`/`Next` text and the whole `Ellipsis` through the RAC `Span` wrapper; replaced with native spans, removing a React Aria dependency from this family.
4. **Dead tv slots removed** — the ref recipe's `item: ""` and `button: ""` slots are empty strings invoked for nothing; deleted from the recipe (Item is unstyled; Link uses `buttonVariants` + `link` slot).
5. **`data-slot` attributes ADDED** — the ref emits none (the family's odd one out); ours adds the full §2 set per family convention.
6. **Style file renamed** — ref: `styles/paginaton.ts` (typo); ours: `styles/pagination.ts`, still exported through the `./styles` barrel, `paginationVariants` stays **public**.
7. **Icons → Phosphor** — `Icon.ChevronLeft`/`Icon.ChevronRight` → `CaretLeft`/`CaretRight`; `Icon.MoreHorizontal` → `DotsThree`, from `@elmeragroup/ui/icons`.
8. **KEPT: required `text` on Previous/Next** — deliberate; no baked-in English strings, i18n injected by the consumer.
9. **KEPT: `isActive` → outline-vs-ghost mapping**, `size="icon"` default on Link, `size="default"` on Previous/Next, and the vestigial-looking `VariantProps<typeof paginationVariants>` intersections are simplified to the shapes in §3 (the ref sprinkles `VariantProps` on every part though only Previous/Next use the `direction` axis internally — trimmed to actual usage; `direction` is not a consumer-facing prop).

## 9 Test requirements

- Role queries only: `getByRole("navigation", { name: "pagination" })`; page links via `getByRole("link", { name })`.
- **`aria-current`**: `isActive` link exposes `aria-current="page"`; inactive links have no `aria-current` attribute at all (never `"false"`).
- **Nav label**: landmark queryable by its label; overriding `aria-label` via props wins over the baked-in default.
- Previous/Next render their required `text` visibly and keep accessible names "Go to previous/next page" by default.
- Ellipsis hidden from the a11y tree; sr-only "More pages" present in markup.
- `isActive` flips the rendered `buttonVariants` variant (assert via outline-specific class or `data-slot` + class diff).

## 10 Demo requirements

Plain runnable `.tsx` demos: `pagination-basic.tsx` (numbered pages + Previous/Next with Norwegian `text`), `pagination-ellipsis.tsx` (long range collapsed with Ellipsis), `pagination-controlled.tsx` (state-driven `isActive` + click handlers on anchors).
