# Separator

## 1 Header

- **Canonical name**: `Separator` (single component — no namespace parts)
- **Export path**: `@elmeragroup/ui/separator` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — base-ui Separator primitive
- **Tier**: base-ui leaf primitive wrapper
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/separator.tsx` — the ref also ships a second, older `src/separator.tsx` at the root; **the base-ui version wins** (template ruling, §8) and the root file is retired.

## 2 Anatomy

| Part        | base-ui primitive                           | data-slot   |
| ----------- | ------------------------------------------- | ----------- |
| `Separator` | `Separator` from `@base-ui/react/separator` | `separator` |

Renders a single `<div>` (base-ui default) — a visual and semantic divider.

```tsx
<div className="flex items-center gap-4">
  <span>Docs</span>
  <Separator orientation="vertical" />
  <span>Source</span>
</div>
```

## 3 Props

`ComponentProps<typeof SeparatorPrimitive>` — pass-through includes `render`.

| Prop          | Type                         | Default        | Notes                                                                                                                 |
| ------------- | ---------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | forwarded to the primitive, which emits `data-orientation`; sizing is CSS-driven off that attribute, not a JS ternary |
| `className`   | `string`                     | —              | merged via `cn`                                                                                                       |

Base classes: `shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch`.

## 4 Variants

None — no tv recipe, no axes. Orientation is a prop mapped to data-attribute-driven CSS, not a variant.

## 5 Consumed tokens

`border` (`bg-border`) — the only token. No radius, no ring.

## 6 Data attributes

**Emitted**: `data-slot="separator"` (placed **before** `{...props}` so wrappers can override it — the SidebarSeparator requirement, §8.3); base-ui emits `data-orientation` → Tailwind's `data-horizontal:`/`data-vertical:` shorthands.

**Consumed**: its own `data-orientation` for sizing (§3). No group/peer scopes.

## 7 Accessibility

- base-ui renders `role="separator"` with `aria-orientation` when the divider is semantic; consumers pass the primitive's decorative escape hatch through props when the divider is purely visual.
- Not focusable, no keyboard behavior.

## 8 Divergence from reference

1. **ONE canonical component (template ruling)** — the ref contains two competing implementations: `src/base-ui/separator.tsx` (newer) and `src/separator.tsx` (root, older). The base-ui version is canonical; the root file is retired with no rename or alias. Exact behavioral deltas between them:
   - **`data-slot`**: base-ui version emits `data-slot="separator"`; the root version emits none.
   - **Orientation mechanism**: base-ui version is CSS/data-attribute driven — `data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch` react to the primitive's `data-orientation`, so the rendered classes are orientation-agnostic. The root version branches in JS: `orientation === "horizontal" ? "h-px w-full" : "h-full w-px"` — the class list is baked per render and cannot respond to attribute changes.
   - **Vertical sizing**: base-ui version uses `self-stretch` — in a flex row it stretches to the row's cross-axis size even when the parent has no explicit height. The root version uses `h-full`, which resolves to `0` unless an ancestor defines a height — the classic invisible-divider bug. `self-stretch` wins.
2. **No other cleanup needed** — no `dark:` classes, no raw palette classes, no lucide icons in either file.
3. **SidebarSeparator spread-order requirement (KEPT)** — `data-slot="separator"` must stay **before** the props spread: `SidebarSeparator` (sidebar composite) wraps this component and passes `data-slot="sidebar-separator"` + `data-sidebar="separator"` as props, relying on later-spread props overriding the baked-in attribute. Reordering the JSX (spread first) would silently break every wrapping composite's slot identity.

## 9 Test requirements

- Default render: `getByRole("separator")` with `aria-orientation` reflecting the default horizontal orientation; `data-slot="separator"` present.
- `orientation="vertical"` emits `data-orientation="vertical"` and the role's `aria-orientation="vertical"`.
- Vertical separator inside a flex row with no explicit height has non-zero rendered height (the `self-stretch` regression guard vs the retired `h-full` version — browser test).
- A wrapper passing `data-slot="custom"` via props wins over the baked-in value (spread-order guard for SidebarSeparator).
- `className` merges after base classes (consumer `bg-x`-token override wins via `cn`).
- Type tests (`*.test-d.tsx`, tooling §7.3): `SeparatorProps["orientation"]` is the two-value primitive axis and stays optional; the polymorphic escape is `useRender`'s `render`, never an `as` prop _(Added 2026-09-03 — [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

Plain runnable `.tsx` demos: `separator-horizontal.tsx` (stacked text blocks divided horizontally), `separator-vertical.tsx` (inline links in a flex row divided vertically — demonstrates `self-stretch` with no fixed height).
