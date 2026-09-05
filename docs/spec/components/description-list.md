# DescriptionList

## 1 Header

- **Canonical name**: `DescriptionList` — namespace compound: `DescriptionList.Root`, `DescriptionList.Heading`, `DescriptionList.Content`, `DescriptionList.Term`, `DescriptionList.Details`
- **Export path**: `@elmeragroup/ui/description-list` (also re-exported from `@elmeragroup/ui`)
- **Tier**: plain-element composite (semantic `<dl>/<dt>/<dd>` markup; no base-ui primitive)
- **RSC**: server — the stateless wrapper may render client `Heading` as a child
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/description-list.tsx`

## 2 Anatomy

| Part | Renders | data-slot |
| --- | --- | --- |
| `DescriptionList.Root` | `<div>` — bare grouping wrapper | `description-list` |
| `DescriptionList.Heading` | `<h2>` (plain semantic heading) | `description-list-heading` |
| `DescriptionList.Content` | `<dl>` — responsive two-column grid | `description-list-content` |
| `DescriptionList.Term` | `<dt>` | `description-list-term` |
| `DescriptionList.Details` | `<dd>` | `description-list-details` |

```tsx
<DescriptionList.Root>
  <DescriptionList.Heading>Customer</DescriptionList.Heading>
  <DescriptionList.Content>
    <DescriptionList.Term>Name</DescriptionList.Term>
    <DescriptionList.Details>Kari Nordmann</DescriptionList.Details>
    <DescriptionList.Term>Meter point</DescriptionList.Term>
    <DescriptionList.Details>7070575000…</DescriptionList.Details>
  </DescriptionList.Content>
</DescriptionList.Root>
```

**`Root` is a bare div — purely semantic.** It applies no classes, no layout, no state; it exists only to group a heading with its list (and as the stable namespace anchor). All layout lives on `Content`.

## 3 Props

All styled parts take `className` (merged via `cn`) plus native element pass-through; none hold state.

| Part | Type | Notes |
| --- | --- | --- |
| `DescriptionList.Root` | `ComponentProps<"div">` | no default classes; passes everything through |
| `DescriptionList.Heading` | `ComponentProps<"h2">` | plain `<h2>` by default; polymorphic via `render` (`useRender`) for other levels |
| `DescriptionList.Content` | `ComponentProps<"dl">` | `grid grid-cols-1 text-base/6 sm:grid-cols-[min(50%,calc(var(--spacing)*80))_auto] sm:text-sm/6` — single column on mobile; ≥`sm`, term column is `min(50%, 20rem)` |
| `DescriptionList.Term` | `ComponentProps<"dt">` | `col-start-1 border-t py-2 pr-2 text-muted-foreground first-of-type:border-none` |
| `DescriptionList.Details` | `ComponentProps<"dd">` | `py-2 text-foreground first-of-type:border-none sm:border-t` — top border only at ≥`sm`; on mobile the `<dt>` alone carries the row divider |

## 4 Variants

None — no tv recipe, no variant axes. The mobile/desktop layout switch is the `sm:` breakpoint on `Content`/`Details`, not a prop.

## 5 Consumed tokens

`muted-foreground` (Term), `foreground` (Details), `border` (row dividers on Term and, ≥`sm`, Details), `--spacing` (the `calc(var(--spacing)*80)` term-column clamp — kept arithmetic). Heading text styles are plain type classes (`font-heading text-lg leading-snug font-medium text-inherit`); no background or radius tokens.

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2. Note this is additive relative to the ref, which emits no `data-slot` attributes in this file (§8.4). No state attributes — the component is stateless.

**Consumed**: none. No group/peer scopes, no cross-component selector contracts (unlike table.md/frame.md).

## 7 Accessibility

- Native `<dl>/<dt>/<dd>` semantics: term/definition association is structural; multiple `<dt>`s may share a `<dd>` and vice versa per the HTML content model — the grid styles (`col-start-1` on Term) tolerate this.
- `Heading` is a real `<h2>` in the document outline; it is not programmatically associated with the `<dl>` — consumers add `aria-labelledby` on `Content` when the association matters.
- Purely static: no keyboard behavior, no focus management, no ARIA wiring.
- Reading order equals DOM order (term, then details) in both the one-column and two-column layouts.

## 8 Divergence from reference

1. **Rename: flat → namespace** — ref exports `DescriptionList`, `DescriptionListHeading`, `DescriptionListContent`, `DescriptionTerm`, `DescriptionDetails` (plus a `DescriptionListRoot` re-export alias of `DescriptionList`); ours are `DescriptionList.Root/.Heading/.Content/.Term/.Details`. The alias export is dropped.
2. **DE-RAC (ruled)** — the ref's `DescriptionListHeading` wraps react-aria `Heading` with `level={2}` hardcoded before the props spread (so overridable via a `level` prop in practice); replaced by a plain semantic `<h2>` carrying the identical classes the ref's Heading emitted at level 2 (`font-heading text-inherit text-lg leading-snug font-medium`). react-aria leaves this family entirely; other levels via `render`.
3. **Spread-order normalized (minor, ruled)** — the ref's `DescriptionDetails` is the family's one inconsistency: it spreads `{...props}` **before** `className={cn(...)}` (every sibling puts `className` first, spread last). Behavior is equivalent (`className` is destructured either way), but the shape is normalized to the family convention: `cn` merge first, spread last.
4. **`data-slot` attributes added** — the ref emits none in this file; ours emit the §2 set per family convention so the parts are selectable/testable like every other component.
5. **KEPT**: `Root` as a bare, class-free div (purely semantic — stated in §2, not "fixed"); the `min(50%,calc(var(--spacing)*80))` column arithmetic; the mobile-vs-`sm` border split between Term and Details.
6. No `dark:` classes, no raw palette classes in the ref — nothing to clean.

## 9 Test requirements

- Structure queries: `Content` renders a `<dl>` containing alternating `<dt>`/`<dd>` in DOM order; `getByRole("term")` / `getByRole("definition")` resolve where the platform exposes them, with tag-level assertions as the fallback (dl/dt/dd role mapping is inconsistent across engines — assert the elements).
- `Heading` is `getByRole("heading", { level: 2 })`; a `render` override changes the level without losing classes or `data-slot`.
- `Root` passes through arbitrary props/attributes and adds no classes of its own.
- `className` merges via `cn` on every part, including `Details` (regression guard for §8.3: consumer `className` must win over base classes).
- **Browser test (layout contract)**: ≥`sm`, terms and details form two columns with the term column capped at `min(50%, 20rem)`; first row has no top border, subsequent rows do.

## 10 Demo requirements

Plain runnable `.tsx` demos: `description-list-basic.tsx` (Root > Heading + Content with 4–5 term/details pairs), `description-list-multi-details.tsx` (one term with two details and one details with two terms — the content-model tolerance), `description-list-responsive.tsx` (long values demonstrating the mobile single-column vs `sm:` two-column switch).
