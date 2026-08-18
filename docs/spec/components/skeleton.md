# Skeleton

## 1 Header

- **Canonical name**: `Skeleton` — single component, no namespace (locked: stays single; no `.Root`)
- **Export path**: `@elmeragroup/ui` (`import { Skeleton } from "@elmeragroup/ui"`)
- **Tier**: plain element (one `<div>`; no base-ui primitive, no state)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/skeleton.tsx`

## 2 Anatomy

| Part | Renders | data-slot |
| --- | --- | --- |
| `Skeleton` | `<div class="animate-pulse rounded-md bg-muted">` | `skeleton` |

```tsx
<Skeleton className="h-4 w-full max-w-24" />
```

A shape-only placeholder: it has no intrinsic size — consumers size it via `className` to match the content it stands in for. `VerticalTable.Key`/`.Value` render it internally when `isLoading` (see table.md §3), sized `h-4 w-full max-w-24` (or `h-lh` in the compact variant).

## 3 Props

| Part | Type | Notes |
| --- | --- | --- |
| `Skeleton` | `ComponentProps<"div">` | `className` merged via `cn`; everything else passes through. No `isLoading` prop — rendering the component *is* the loading state; consumers conditionally render it |

## 4 Variants

None — no tv recipe, no variant axes. Shape, size, and count are entirely consumer-side via `className` and repetition. The pulse is the stock Tailwind `animate-pulse` keyframe.

## 5 Consumed tokens

`muted` (`bg-muted` fill — the canonical skeleton surface across the family; table.md §8.4 normalizes its one raw-palette override to this token), `--radius-md` (`rounded-md`). Nothing else.

## 6 Data attributes

**Emitted**: `data-slot="skeleton"`. Note this is additive relative to the ref, which emits no `data-slot` (§8.2). No state attributes.

**Consumed**: none of its own. Ancestors may restyle it by selector — e.g. `VerticalTable`'s compact variant stretches it via `in-data-[variant=non-bordered-compact]:h-lh` on the class it passes in (table.md §4).

## 7 Accessibility

- Purely decorative: a styled div with no role, no text, no interactivity. It should not be announced — consumers rendering skeleton regions set `aria-hidden="true"` on the placeholder block (or the skeletons themselves) and communicate loading via `aria-busy="true"` on the region being loaded, with a polite live-region announcement where the load matters.
- `animate-pulse` is an opacity animation; it is low-motion and acceptable under `prefers-reduced-motion`, but themes may still tone it down globally — the component adds no motion queries of its own.
- No keyboard behavior, no focus semantics; a skeleton must never be a focus target.

## 8 Divergence from reference

1. **Prop type normalized** — ref types props as `React.HTMLAttributes<HTMLDivElement>` (which omits `ref`); ours is `ComponentProps<"div">` like every sibling part, so `ref` passes through. No behavioral change otherwise.
2. **`data-slot="skeleton"` added** — the ref emits no `data-slot`; added per family convention (selectability in tests and ancestor styling).
3. **Kept single** (locked) — no namespace, no `Skeleton.Root`; the ref's single-export shape is already the intended API.
4. **Consumer-side fix recorded here for cross-reference**: the ref's only skeleton color override in the family (`bg-neutral-90` in table.tsx's compact vertical table) is a raw palette class; it is resolved to `bg-muted` — identical to this component's base fill, so the override disappears (ruled in table.md §8.4).
5. No `dark:` classes, no icons, no react-aria — nothing else to clean.

## 9 Test requirements

- Renders a `<div>` with `data-slot="skeleton"`; no role queries apply (assert it is *absent* from the accessibility tree when the consumer pattern `aria-hidden` is applied — the demo pattern is the tested pattern).
- `className` merges via `cn`: consumer sizing classes coexist with the base classes; a consumer `bg-*` override wins over `bg-muted`.
- Arbitrary props (`id`, `data-*`, event handlers) and `ref` pass through to the div (regression guard for §8.1).
- Static/type-level: props type is `ComponentProps<"div">`.
- No browser test needed of its own; the in-table skeleton sizing is covered by table.md §9.

## 10 Demo requirements

Plain runnable `.tsx` demos: `skeleton-basic.tsx` (text-line stack: three widths of `h-4` bars plus a `size-10 rounded-full` avatar circle, wrapped in an `aria-hidden` block with `aria-busy` on the region — the canonical consumer pattern), `skeleton-card.tsx` (a card-shaped composite placeholder mirroring a real layout), plus the shared table scenario `vertical-table-data.tsx` (table.md §10) exercising skeletons via `isLoading`.
