# Breadcrumb

## 1 Header

- **Canonical name**: `Breadcrumb` — namespace compound: `Breadcrumb.Root`, `Breadcrumb.List`, `Breadcrumb.Item`, `Breadcrumb.Link`, `Breadcrumb.Page`, `Breadcrumb.Separator`, `Breadcrumb.Ellipsis`
- **Export path**: `@elmeragroup/ui/breadcrumb` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — `Breadcrumb.Link` uses base-ui `useRender`
- **Tier**: plain-element composite (no base-ui state primitive; `useRender` for polymorphism)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/breadcrumb.tsx`

## 2 Anatomy

| Part                   | Renders                                                                      | data-slot                            |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| `Breadcrumb.Root`      | `<nav>` with localized landmark label                                        | `breadcrumb`                         |
| `Breadcrumb.List`      | `<ol>`                                                                       | `breadcrumb-list`                    |
| `Breadcrumb.Item`      | `<li>`                                                                       | `breadcrumb-item`                    |
| `Breadcrumb.Link`      | `<a>` via `useRender` (polymorphic)                                          | `breadcrumb-link` (via `state.slot`) |
| `Breadcrumb.Page`      | `<span role="link">` (current page)                                          | `breadcrumb-page`                    |
| `Breadcrumb.Separator` | `<li role="presentation">`, default `<CaretRight />` child                   | `breadcrumb-separator`               |
| `Breadcrumb.Ellipsis`  | `<span>` with an aria-hidden `<DotsThree />` + localized sr-only “more” text | `breadcrumb-ellipsis`                |

```tsx
<Breadcrumb.Root>
  <Breadcrumb.List>
    <Breadcrumb.Item>
      <Breadcrumb.Link render={<RouterLink href="/" />}>Home</Breadcrumb.Link>
    </Breadcrumb.Item>
    <Breadcrumb.Separator />
    <Breadcrumb.Item>
      <Breadcrumb.Page>Orders</Breadcrumb.Page>
    </Breadcrumb.Item>
  </Breadcrumb.List>
</Breadcrumb.Root>
```

## 3 Props

All parts take `className` (merged via `cn`) plus native element pass-through; none hold state.

| Part                   | Type                                                            | Notes                                                                         |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Breadcrumb.Root`      | `ComponentProps<"nav"> & { label?: string }`                    | `label` defaults to dictionary `landmark`; explicit `aria-label` wins         |
| `Breadcrumb.List`      | `ComponentProps<"ol">`                                          | flex-wrap layout, `gap-1.5 sm:gap-2.5`                                        |
| `Breadcrumb.Item`      | `ComponentProps<"li">`                                          | `inline-flex items-center gap-1.5`                                            |
| `Breadcrumb.Link`      | `useRender.ComponentProps<"a">`                                 | `render` prop swaps the element (router links); see §4 note below             |
| `Breadcrumb.Page`      | `ComponentProps<"span">`                                        | `role="link" aria-disabled="true" aria-current="page"` baked in               |
| `Breadcrumb.Separator` | `ComponentProps<"li">`                                          | `children` replaces the default `<CaretRight />`                              |
| `Breadcrumb.Ellipsis`  | `Omit<ComponentProps<"span">, "children"> & { label?: string }` | `label` defaults to dictionary `more` and renders sr-only; children are owned |

**`Breadcrumb.Link` is the convention exemplar for polymorphism**: it calls `useRender({ defaultTagName: "a", props: mergeProps<"a">({ className }, props), render, state: { slot: "breadcrumb-link" } })`. The `state.slot` value is how a `useRender`-based part emits its `data-slot` (base-ui serializes state to `data-*`) — parts built on `useRender` must use this pattern rather than a literal `data-slot` prop, so the attribute survives custom `render` elements. Never an `as` prop.

## 4 Variants

None — no tv recipe; all parts are single-look plain class strings. `Breadcrumb.Link` composes shared `focusRing({ target: "self" })`. No variant axes.

## 5 Consumed tokens

`muted-foreground` (List sets the resting text color for the whole trail), `foreground` (`hover:text-foreground` on Link; `text-foreground` on Page), and `ring`/`background` through Link's focus recipe. No borders or radii.

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2 (Link's arrives via `useRender` `state.slot`). No state attributes — the component is stateless.

**Consumed**: Separator styles descendant svg via `[&>svg]:size-3.5`; Ellipsis via `[&>svg]:size-4`. No group/peer scopes.

## 7 Accessibility

- Root is a labeled `<nav>` landmark; the trail is an ordered list, so item count/position is announced.
- Current page: `Breadcrumb.Page` uses the WAI-ARIA breadcrumb pattern — `role="link"` + `aria-disabled="true"` + `aria-current="page"` on a `<span>`: announced as a link (consistent with its siblings) but non-operable, and marked current. Documented pattern, kept verbatim.
- `Breadcrumb.Separator`: `role="presentation" aria-hidden="true"` — purely visual, invisible to AT.
- `Breadcrumb.Ellipsis`: the icon is `aria-hidden`; localized sr-only text announces omitted items. When it triggers a dropdown, the interactive wrapper owns its own accessible name — Ellipsis itself is not interactive.
- No composite keyboard behavior; links are ordinary tab stops and show the shared ring on keyboard focus.

## 8 Divergence from reference

1. **Rename: flat → namespace** — ref exports `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`; ours are `Breadcrumb.Root/.List/.Item/.Link/.Page/.Separator/.Ellipsis`.
2. **Icons → Phosphor** — ref imports lucide `ChevronRightIcon` and `MoreHorizontalIcon`; ours use `CaretRight` (Separator default child) and `DotsThree` (Ellipsis) from `@elmeragroup/ui/icons`, regular weight.
3. **KEPT and elevated: the `useRender`/`state.slot` pattern on `Breadcrumb.Link`** — this file is the reference implementation of the conventions' "polymorphism via `useRender`" rule and the `state.slot → data-slot` mechanism; other specs point here.
4. **KEPT: `BreadcrumbPage` role/aria trio** — `role="link" aria-disabled="true" aria-current="page"` retained exactly (see §7 rationale).
5. No `dark:` classes, no raw palette classes in the ref — nothing to clean.
6. Hardcoded English `"breadcrumb"`/`"More"` become provider-locale dictionary defaults with optional prop overrides.
7. **Focus unified:** `Breadcrumb.Link` composes the canonical self-focus adapter.

## 9 Test requirements

- Role queries only: `getByRole("navigation", { name: "breadcrumb" })` finds the landmark; links via `getByRole("link", { name })`.
- **Current page**: `Breadcrumb.Page` is queryable as `getByRole("link", { name, current: "page" })` and has `aria-disabled="true"`; it is not focusable/clickable-navigating.
- `Breadcrumb.Link` with `render={<a href>}` (or a router link) renders the custom element, keeps merged className, and emits `data-slot="breadcrumb-link"` on it.
- Separator is absent from the accessibility tree; Ellipsis exposes the locale's sr-only `more` string.
- All four locale defaults and both explicit label overrides are covered.
- List renders as an `<ol>` with one `<li>` per item + separators.

## 10 Demo requirements

Plain runnable `.tsx` demos: `breadcrumb-basic.tsx` (three-level trail ending in `Breadcrumb.Page`), `breadcrumb-custom-separator.tsx` (slash text separator via children), `breadcrumb-ellipsis.tsx` (collapsed middle with `Breadcrumb.Ellipsis`), `breadcrumb-render-link.tsx` (`render` prop with a custom link component — the polymorphism exemplar).
