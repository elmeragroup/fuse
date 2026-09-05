# Span

## 1 Header

- **Canonical name**: `Span` (single component); recipe `spanVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/span` (also re-exported from `@elmeragroup/ui`); `spanVariants` comes from the same entry
- **RSC**: client — uses base-ui `useRender`
- **Tier**: styled typography primitive (plain `span`; no base-ui primitive, no RAC)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/span.tsx` + `src/styles/span.ts` (extends `styles/text.ts`)

## 2 Anatomy

Single `span` element. **RE-HOMED**: the ref wraps react-aria `Text` with a **forced** `elementType="span"` (the prop is `Omit`ted from its public type); this spec renders a plain `span` directly (user-ruled). Bare path unchanged — the app's import sites (part of ~290 typography imports across ~220 files; `pagination` composes it internally) keep working.

```tsx
<Span size="sm" variant="muted">4 of 12</Span>
<Span truncate className="max-w-40">very-long-inline-value</Span>
```

Span is the inline sibling of Text: same recipe surface, `leading` default tightened to `snug` for inline use.

## 3 Props

`SpanProps = React.ComponentPropsWithoutRef<"span"> & VariantProps<typeof spanVariants> & { render?: useRender.RenderProp }` — exported (renamed from the ref's colliding `TextProps`, §8). No `elementType` prop — the ref omitted it and the spec keeps the span-only face (`render` covers escape hatches).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | see §4 | `"default"` | tv axis (inherited from `textVariants`) |
| `size` | see §4 | `"default"` | tv axis; includes the `*:`/`**:` descendant cascade |
| `leading` | `"none" \| "tight" \| "snug" \| "relaxed" \| "loose"` | `"snug"` | span's own default (Text defaults `relaxed`) |
| `truncate` | `boolean` | — | adds `truncate` |
| `weight` | `"normal" \| "medium" \| "bold"` | `"normal"` | `bold` maps to `font-medium` (inherited, see text.md §4) |
| `align` | `"left" \| "center" \| "right" \| "justify"` | — | inherited recipe axis, surfaced (§8) |
| `render` | `useRender` render prop | — | polymorphism, ADDED (§8) |
| `className` | `string` | — | merged via `cn`, wins over recipe |
| …rest | native `span` props | — | spread onto the element |

The ref's `slot` prop (RAC slot wiring) is **dropped** (§8 — migration note).

## 4 Variants

Recipe: **`spanVariants`** — **PUBLIC** from `@elmeragroup/ui/span`. Defined as `tv({ extend: textVariants, defaultVariants: { leading: "snug" } })`; it inherits the text axes and overrides only `leading`. Internal composition uses relative source imports; consumers use component entries.

| Axis | Values | Default |
| --- | --- | --- |
| `variant` | 9 values, = textVariants | `default` |
| `size` | `xs`–`2xl` (6), = textVariants incl. `*:`/`**:` cascade | `default` |
| `leading` | 5 values, = textVariants | **`snug`** (only delta from parent) |
| `truncate` / `align` / `weight` | = textVariants | — / — / `normal` |

Base: `font-sans` (inherited). `destructive` keeps its value name; class renames to `text-error` in the parent recipe (§8).

## 5 Consumed tokens

Identical to text.md §5 (shared recipe): `muted-foreground`, `foreground`, `primary`, `secondary`, `brand`, `error` (via `destructive` value), `success`, `font-sans`.

## 6 Data attributes

**Emitted**: `data-slot="span"` (added in spec — §8; ref emits none).

**Consumed**: none.

## 7 Accessibility

- Plain inline `span` — no implicit role, not focusable, no keyboard behavior.
- `truncate` is visual-only; consumers must keep truncated values otherwise reachable when they carry meaning.
- No aria wiring; the dropped RAC `slot` auto-labelling is covered by the field family / date cluster internals.

## 8 Divergence from reference

1. **RE-HOME (de-RAC)**: ref renders react-aria `Text` with hard-coded `elementType="span"`; spec renders a plain `span`. Same public face: no `elementType` prop in either (the ref `Omit`s it) — the forced-span identity is kept.
2. **`slot` prop dropped** — migration note: app sites pass `slot="description"` to `Span` inside RAC radio/checkbox contexts (e.g. `components/predictable-payment/predictable-payment-sites.tsx`, `components/form/fixed-price/fixed-price-form-fields.tsx`, `components/form/steps/power-trade/step-power-trade.tsx`, `components/form/radio-groups/invoice-type.tsx`). Those relied on RAC `TextContext` wiring `aria-describedby`; replacements use the owning composite's Description part, or the date cluster's private RAC `Text` inside that cluster. Rare and enumerable; TypeScript flags stragglers.
3. **Exported type renamed `TextProps` → `SpanProps`**: the ref's `span.tsx` exports `TextProps`, colliding with `react-aria/text.tsx` and `react-aria/field.tsx` exports of the same name. Ruling: one `TextProps` (text.md), one `SpanProps` (here), field's alias goes private/renamed.
4. **`render` prop added** (base-ui `useRender` + `mergeProps`) — ref had no polymorphism; with heading/text this completes the canonical polymorphic text primitives. Never an `as` prop.
5. **`destructive` → `error` class rename** in the parent recipe: value name kept, class becomes `text-error` per conventions.
6. **`align` axis surfaced** as a documented prop (recipe-only in the ref).
7. **`data-slot="span"` added**; `displayName` kept.

## 9 Test requirements

- Renders a `span` (tag assertion); exposes no widget role; children text reachable via `getByText`.
- Default `leading` resolves `leading-snug` (delta vs `textVariants`' `relaxed` — regression-guard the extend).
- Variant/size/weight parametrized against the shared table: `destructive` → `text-error`, `weight="bold"` → `font-medium`, `size="xs"` includes the `*:`/`**:` cascade classes.
- `truncate` adds `truncate`; `className` merge wins via `cn`; `render` prop renders the provided element with merged classes.
- Passing `slot` or `elementType` is a type error (compile-time assertions).
- `spanVariants` unit: defaults resolve `variant/size: default, leading: snug, weight: normal`; no raw palette classes, no `dark:` variants.

## 10 Demo requirements

Plain runnable `.tsx` demos: `span-basic.tsx` (inline values inside a sentence set with Text), `span-sizes.tsx` (xs→2xl inline type scale showcase), `span-variants.tsx` (muted/success/destructive inline statuses, e.g. pagination "4 of 12"), `span-truncate.tsx` (truncated inline value in a constrained row).
