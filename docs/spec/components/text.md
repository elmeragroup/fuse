# Text

## 1 Header

- **Canonical name**: `Text` (single component); recipe `textVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/text` — the ref's existing bare path, kept (`import { Text } from "@elmeragroup/ui/text"`); recipe also via the styles layer
- **Tier**: styled typography primitive (plain `p` by default; no base-ui primitive, no RAC)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/text.tsx` + `src/styles/text.ts`

## 2 Anatomy

Single text element. **RE-HOMED**: the ref wraps react-aria `Text` with `elementType` defaulted to `"p"`; this spec renders the element named by `elementType` directly (user-ruled). The bare path is unchanged so the app's import sites (part of ~290 typography imports across ~220 files) keep working.

```tsx
<Text>Body copy.</Text>                          // renders <p>
<Text elementType="span" size="lg">Inline.</Text> // app uses this widely (error pages etc.)
<Text variant="muted" size="sm" truncate>…</Text>
```

RAC's `Text` slot mechanism is NOT re-created standalone — the date cluster keeps its own private RAC `Text` for slot wiring.

## 3 Props

`TextProps = React.ComponentPropsWithoutRef<"p"> & VariantProps<typeof textVariants> & { elementType?: string; render?: useRender.RenderProp }` — exported (name disambiguated, §8).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `elementType` | `string` (tag name) | `"p"` | ref's public face kept exactly — the ref forwards it to RAC `Text`, which renders that tag; app code passes `"span"` and `"div"` today, so the prop stays even though `render` (below) also covers polymorphism |
| `variant` | see §4 | `"default"` | tv axis |
| `size` | see §4 | `"default"` | tv axis; classes also cascade to children via `*:`/`**:` selectors (kept from ref) |
| `leading` | `"none" \| "tight" \| "snug" \| "relaxed" \| "loose"` | `"relaxed"` | line-height axis |
| `truncate` | `boolean` | — | adds `truncate` |
| `weight` | `"normal" \| "medium" \| "bold"` | `"normal"` | note: ref maps `bold` to `font-medium` (§4) |
| `align` | `"left" \| "center" \| "right" \| "justify"` | — | tv axis present in the recipe (reachable via variant spread in the ref — kept public) |
| `render` | `useRender` render prop | — | polymorphism, ADDED (§8) |
| `className` | `string` | — | merged via `cn`, wins over recipe |
| …rest | native element props | — | spread onto the element |

The ref's `slot` prop (RAC slot wiring) is **dropped** (§8 — migration note).

## 4 Variants

Recipe: **`textVariants`** — **PUBLIC**. It lives in the borrowable styles layer; `spanVariants` extends it (span.md) and de-RAC'd families (card descriptions, table cells) render these classes on plain elements — sanctioned borrow, exported and typed via `VariantProps`.

| Axis | Values | Default |
| --- | --- | --- |
| `variant` | `default` (`text-inherit`) · `foreground` · `primary` · `secondary` · `brand` · `muted` (`text-muted-foreground`) · `inherit` · `destructive` · `success` (9) | `default` |
| `size` | `xs` · `sm` · `default` (`text-base`) · `lg` · `xl` · `2xl` — each as `text-{s} *:text-{s} **:text-{s}` (6) | `default` |
| `leading` | `none` · `tight` · `snug` · `relaxed` · `loose` | `relaxed` |
| `truncate` | `true` (`truncate`) | — |
| `align` | `left` · `center` · `right` · `justify` | — |
| `weight` | `normal` (`font-normal`) · `medium` (`font-medium`) · `bold` (**`font-medium`** — ref maps bold to medium; KEPT, deliberate cap on body-copy weight) | `normal` |

Base: `font-sans`. The `size` classes deliberately restyle descendants (`*:`/`**:`) so nested inline elements inherit the scale — kept from ref. `destructive` keeps its value name but its class renames to `text-error` (§8).

## 5 Consumed tokens

- `muted-foreground`, `foreground`, `primary`, `secondary`, `brand` — variant text colors.
- `error` (via `destructive` value), `success` — status text.
- `font-sans` — body font-family token.

## 6 Data attributes

**Emitted**: `data-slot="text"` (added in spec — §8; ref emits none).

**Consumed**: none.

## 7 Accessibility

- Renders a plain `p` (or the `elementType` tag) — no implicit widget role, not focusable, no keyboard behavior.
- `truncate` hides overflow visually only; consumers must ensure the full value is otherwise reachable (e.g. `title` or a tooltip) when truncation can hide meaning.
- No aria wiring; the dropped RAC `slot="description"` auto-labelling never applied outside RAC contexts.

## 8 Divergence from reference

1. **RE-HOME (de-RAC)**: ref renders react-aria `Text` (which consumes `TextContext` for slot props); spec renders the plain `elementType` element. Public face unchanged: `elementType` default `"p"` and all variant props kept.
2. **`slot` prop dropped** — migration note: app sites passing `slot="description"` to `Text` inside RAC field/radio contexts exist in the ref app (e.g. `components/ui/label-value.tsx`, `components/form/feedback/form-feedback-shared.tsx`, `components/form/new-order/field-groups/field-group-customer.tsx`). Those relied on RAC context auto-wiring `aria-describedby`; in the new library that wiring comes from the field family's own Description part, and slotted text inside the date cluster uses the cluster's private RAC `Text`. The prop is simply absent here; TypeScript flags stragglers.
3. **`TextProps` disambiguation**: the ref exports THREE colliding `TextProps` types (`react-aria/text.tsx`, `react-aria/span.tsx`, `react-aria/field.tsx`). Ruling: exactly one `TextProps` — this component's; span exports `SpanProps`, field's internal alias goes private/renamed (see span.md §8, field.md).
4. **`render` prop added** (base-ui `useRender` + `mergeProps`) — ref had no polymorphism; canonical polymorphic text primitive. `elementType` is kept alongside for compat (222 files import this family; `elementType="span"` is common).
5. **`destructive` → `error` class rename**: value name kept, class becomes `text-error` per conventions.
6. **`align` axis surfaced** as a documented prop (recipe-only in the ref).
7. **`data-slot="text"` added**; `displayName` kept.

## 9 Test requirements

- Renders a `p` by default (`container.querySelector("p")` / tag assertion); `elementType="span"` renders a `span`; no role is exposed (`queryByRole` for common widget roles is null).
- Each `variant` resolves its class (parametrized); `destructive` resolves `text-error`; `success` resolves `text-success`.
- `size="sm"` output contains `text-sm`, `*:text-sm`, `**:text-sm`; `weight="bold"` resolves `font-medium` (locked ref behavior).
- `leading` default is `leading-relaxed`; `truncate` adds `truncate`; `className` merge wins via `cn`.
- `render` prop renders the provided element with merged classes; passing `slot` is a type error (compile-time assertion).
- `textVariants` unit: defaults resolve `variant/size: default, leading: relaxed, weight: normal`; no raw palette classes, no `dark:` variants.

## 10 Demo requirements

Plain runnable `.tsx` demos: `text-basic.tsx` (paragraph copy at default scale), `text-sizes.tsx` (xs→2xl type scale showcase incl. nested-inline cascade), `text-variants.tsx` (color variants incl. muted/success/destructive on realistic statuses), `text-leading-weight.tsx` (leading ladder + weight values, showing bold==medium), `text-truncate.tsx` (constrained-width truncation).
