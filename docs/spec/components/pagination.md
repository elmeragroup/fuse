# Pagination

## 1 Header

- **Canonical name**: `Pagination` — namespace compound: `Pagination.Root`, `Pagination.Content`, `Pagination.Item`, `Pagination.Link`, `Pagination.Previous`, `Pagination.Next`, `Pagination.Ellipsis`
- **Export path**: `@elmeragroup/ui/pagination` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — reads the required locale context for built-in landmark, navigation, and ellipsis copy
- **Tier**: plain-element composite (no base-ui primitive; anchors styled via borrowed `buttonVariants`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/pagination.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/styles/paginaton.ts` (ref filename is typo'd; ours is `styles/pagination.ts`)

## 2 Anatomy

| Part                  | Renders                                                            | data-slot             |
| --------------------- | ------------------------------------------------------------------ | --------------------- |
| `Pagination.Root`     | `<nav role="navigation">` with localized label                     | `pagination`          |
| `Pagination.Content`  | `<ul>`                                                             | `pagination-content`  |
| `Pagination.Item`     | `<li>`                                                             | `pagination-item`     |
| `Pagination.Link`     | `<a>` styled via `buttonVariants`                                  | `pagination-link`     |
| `Pagination.Previous` | `Pagination.Link` (`size="default"`) with `<CaretLeft />` + text   | `pagination-previous` |
| `Pagination.Next`     | `Pagination.Link` (`size="default"`) with text + `<CaretRight />`  | `pagination-next`     |
| `Pagination.Ellipsis` | `<span>` with aria-hidden `<DotsThree />` + localized sr-only text | `pagination-ellipsis` |

```tsx
<Pagination.Root>
  <Pagination.Content>
    <Pagination.Item>
      <Pagination.Previous href="#" />
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Link href="#" isActive>
        1
      </Pagination.Link>
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Link href="#">2</Pagination.Link>
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Ellipsis />
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Next href="#" />
    </Pagination.Item>
  </Pagination.Content>
</Pagination.Root>
```

## 3 Props

All parts are plain functions (no `forwardRef`; React 19 `ref` flows as a prop). `className` merged via `cn`.

| Part                  | Type                                                                                                                            | Notes                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pagination.Root`     | `ComponentProps<"nav"> & { label?: string }`                                                                                    | localized `landmark` default; explicit `aria-label` wins                                                                                                                                                 |
| `Pagination.Content`  | `ComponentProps<"ul">`                                                                                                          | `flex flex-row items-center gap-1`                                                                                                                                                                       |
| `Pagination.Item`     | `ComponentProps<"li">`                                                                                                          | structural only                                                                                                                                                                                          |
| `Pagination.Link`     | `{ isActive?: boolean } & Pick<ButtonProps, "size"> & ComponentProps<"a">`                                                      | `size` default `"icon"`; see mapping below                                                                                                                                                               |
| `Pagination.Previous` | `Omit<PaginationLinkProps, "size" \| "isActive" \| "children"> & { size?: ButtonProps["size"]; text?: string; label?: string }` | visible `text` defaults to localized `previous`; `label` defaults to `goToPrevious`; explicit `aria-label` wins. Owns its children (caret + text). Not a current-page control — `isActive` is Link-only. |
| `Pagination.Next`     | same Omit as Previous                                                                                                           | visible `next` and `goToNext` defaults                                                                                                                                                                   |
| `Pagination.Ellipsis` | `Omit<ComponentProps<"span">, "children"> & { label?: string }`                                                                 | localized `morePages` sr-only text; not interactive; children are owned                                                                                                                                  |

**`isActive` → button-variant mapping**: `Pagination.Link` renders `buttonVariants({ variant: isActive ? "outline" : "ghost", size })` — the current page reads as an outlined button, all other pages as ghost buttons. `isActive` also drives `aria-current="page"` via the `isActive ? "page" : undefined` idiom.

## 4 Variants

**Recipe: `paginationVariants` — PUBLIC**, exported from `@elmeragroup/ui/pagination` with the component. It composes `buttonVariants` internally; there is no public styles barrel.

Slots: `base` (`mx-auto flex w-full flex-col items-center justify-center space-y-4`), `content` (`flex flex-row items-center gap-1`), `link` (`gap-1`), `linkIcon` (`size-4`), `ellipsis` (`flex size-9 items-center justify-center`), `ellipsisIcon` (`size-4`).

Axis `direction`: `previous` → `link: "pl-2.5"`; `next` → `link: "pr-2.5"` (asymmetric padding so the chevron side sits tighter). No defaults.

The heavy lifting (colors, radius, focus ring, sizing) comes from the **borrowed public `buttonVariants`** (`variant: "outline" | "ghost"`, `size: "icon" | "default"`); `paginationVariants` only adds layout.

## 5 Consumed tokens

Via borrowed `buttonVariants`: `background`, `accent`, `accent-foreground`, `input`/border, `ring` (see button spec §5). Pagination-local slots consume no color tokens — layout classes only.

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2 (added by us — see §8.5). No state attributes beyond `aria-current` on the active link.

**Consumed**: none — no group/peer scopes.

## 7 Accessibility

- Root is a localized `<nav role="navigation">` landmark; pages are list items inside a `<ul>`.
- Current page: `aria-current="page"` on the active `Pagination.Link` (the `x || undefined` idiom — never `"false"`).
- Previous/Next get localized accessible and visible defaults; explicit props override them.
- Ellipsis hides only its icon and exposes localized sr-only text; it is not focusable.
- Links are ordinary anchors — native keyboard/focus semantics; focus ring comes from `buttonVariants`. Use `href`-less handling (or `render` a router link via anchor props) at the consumer level; disabled states are modeled by omitting the link, not `aria-disabled`.

## 8 Divergence from reference (FULL CLEANUP — user-ruled)

1. **Rename: flat → namespace** — ref exports `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`; ours are `Pagination.Root/.Content/.Item/.Link/.Previous/.Next/.Ellipsis`.
2. **`forwardRef` dropped** — ref wraps `Content` and `Item` in `React.forwardRef` (and only those two); React 19 makes `ref` a plain prop, so all parts are plain functions. `displayName` is **kept** on all seven parts (`Pagination.Root` … `Pagination.Ellipsis`), per the namespace convention. _(Amended 2026-09-03 — the entry claimed the displayNames went with `forwardRef`; they ship.)_
3. **react-aria `Span` → plain `<span>`** — ref renders `Previous`/`Next` text and the whole `Ellipsis` through the RAC `Span` wrapper; replaced with native spans, removing a React Aria dependency from this family.
4. **Dead tv slots removed** — the ref recipe's `item: ""` and `button: ""` slots are empty strings invoked for nothing; deleted from the recipe (Item is unstyled; Link uses `buttonVariants` + `link` slot).
5. **`data-slot` attributes ADDED** — the ref emits none (the family's odd one out); ours adds the full §2 set per family convention.
6. **Style file renamed** — ref: `styles/paginaton.ts` (typo); ours: a private recipe source re-exported from the component's own entry; `paginationVariants` stays public.
7. **Icons → Phosphor** — the reference chevron/more-horizontal namespace icons become named `CaretLeft` / `CaretRight` / `DotsThree` imports from `@elmeragroup/ui/icons`.
8. **Localized defaults added:** Previous/Next text and labels, landmark label, and ellipsis text come from the provider dictionary; optional props preserve copy control.
9. **KEPT: `isActive` → outline-vs-ghost mapping**, `size="icon"` default on Link, `size="default"` on Previous/Next, and the vestigial-looking `VariantProps<typeof paginationVariants>` intersections are simplified to the shapes in §3 (the ref sprinkles `VariantProps` on every part though only Previous/Next use the `direction` axis internally — trimmed to actual usage; `direction` is not a consumer-facing prop).
10. **Client boundary added:** the plain reference was server-capable, but the provider-only locale ruling requires `useLocalizedStrings`; the component entry is therefore client. A locale prop is not added as a second source of truth.

## 9 Test requirements

- Under `locale="en-US"`, role queries use `getByRole("navigation", { name: "Pagination" })`; page links use `getByRole("link", { name })`.
- **`aria-current`**: `isActive` link exposes `aria-current="page"`; inactive links have no `aria-current` attribute at all (never `"false"`).
- **Nav label**: landmark queryable by its locale-dictionary label; overriding `aria-label` via props wins over that default.
- Previous/Next render locale defaults and use the corresponding accessible names; explicit overrides win.
- Ellipsis icon is hidden; locale-specific sr-only text remains in the accessibility tree.
- All four locale defaults and override precedence are covered.
- `isActive` flips the rendered `buttonVariants` variant (assert via outline-specific class or `data-slot` + class diff).

## 10 Demo requirements

Plain runnable `.tsx` demos: `pagination-basic.tsx` (numbered pages + provider-localized Previous/Next defaults), `pagination-ellipsis.tsx` (long range collapsed with Ellipsis), `pagination-controlled.tsx` (state-driven `isActive` + click handlers on anchors).
