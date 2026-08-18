# Heading

## 1 Header

- **Canonical name**: `Heading` (single component); recipe `headingVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/heading` — the ref's existing bare path, kept (`import { Heading } from "@elmeragroup/ui/heading"`); recipe also via the styles layer
- **Tier**: styled typography primitive (plain `h1`–`h6`; no base-ui primitive, no RAC)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/heading.tsx` + `src/styles/heading.ts`

## 2 Anatomy

Single heading element. **RE-HOMED**: the ref wraps react-aria `Heading`; this spec renders a plain `h{level}` element directly (user-ruled). The bare export path is unchanged, so the app's import sites (part of ~290 typography imports across ~220 files) keep working — only the internals swap.

```tsx
<Heading level={1}>Order overview</Heading>   // renders <h1> at size 2xl (auto)
<Heading level={3} size="sm" variant="muted">Details</Heading>
```

Internal composers in the ref (`card`, `table`, `description-list`, `timeline-list`, `base-ui/disclosure`) render this component or its classes; the de-RAC'd card/table specs already render these exact heading classes on plain elements (see card.md §8 "DE-RAC — Card.Title") — this spec is the canonical home of that recipe.

## 3 Props

`HeadingProps = React.ComponentPropsWithoutRef<"h2"> & VariantProps<typeof headingVariants> & { level?: 1|2|3|4|5|6; render?: useRender.RenderProp }` — exported.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `level` | `1–6` | `2` | picks the rendered `h{level}` element (ref default kept) |
| `variant` | see §4 | `"default"` | tv axis |
| `size` | see §4 | auto from `level` | explicit `size` wins; else `1→"2xl"`, `2→"lg"`, else `"default"` (ref's `getSizeByHeadingLevel`, kept verbatim) |
| `font` | `"default" \| "normal" \| "semi-bold"` | `"default"` | weight axis (medium/normal/semibold) |
| `prose` | `boolean` | — | tv axis; ref maps `true` to an empty class string (kept — reserved hook) |
| `noMargin` | `boolean` | — | adds `mb-0` |
| `uppercase` | `boolean` | — | adds `uppercase` |
| `align` | `"left" \| "center" \| "right"` | — | tv axis present in the recipe (undocumented in the ref component destructure but reachable via variant spread — kept public) |
| `render` | `useRender` render prop | — | polymorphism, ADDED (§8) |
| `className` | `string` | — | merged via `cn`, wins over recipe |
| …rest | native heading props | — | spread onto the element |

The ref's `slot` prop (RAC slot wiring) is **dropped** (§8).

## 4 Variants

Recipe: **`headingVariants`** — **PUBLIC**. It lives in the borrowable styles layer and other families compose it (de-RAC'd card/table titles render heading classes on plain elements); sanctioned borrow, exported and typed via `VariantProps`.

| Axis | Values | Default |
| --- | --- | --- |
| `variant` | `default` (`text-inherit`) · `foreground` · `primary` · `secondary` · `brand` · `muted` (`text-muted-foreground`) · `inherit` · `destructive` (8) | `default` |
| `size` | `default` (`text-base`) · `sm` · `lg` · `xl` · `2xl` · `3xl` · `4xl` · `5xl` (all `leading-snug`) · `6xl` (`leading-tight`) (9) | `default` (auto from `level`) |
| `font` | `default` (`font-medium`) · `normal` (`font-normal`) · `semi-bold` (`font-semibold`) | `default` |
| `prose` | `true` (empty string — reserved) | — |
| `noMargin` | `true` (`mb-0`) | — |
| `uppercase` | `true` (`uppercase`) | — |
| `align` | `left` · `center` · `right` | — |

Base: `font-heading text-foreground`. Note the base sets `text-foreground` while `variant: default` overrides to `text-inherit` — kept from ref (headings inherit surrounding color unless a variant pins one). `destructive` keeps its value name but its class renames to `text-error` (§8).

## 5 Consumed tokens

- `foreground` (base), `muted-foreground`, `primary`, `secondary`, `brand` — variant text colors.
- `error` — via the `destructive` variant value (class renamed, §8).
- `font-heading` — heading font-family token.

## 6 Data attributes

**Emitted**: `data-slot="heading"` (added in spec — §8; ref emits none).

**Consumed**: none.

## 7 Accessibility

- Renders a real `h1`–`h6`; `level` participates in the document outline. Consumers keep levels consistent with page structure — `size` is decoupled from `level` (visual scale never forces outline changes).
- No keyboard behavior; not focusable.
- No aria wiring needed — implicit `heading` role with `aria-level` from the element.

## 8 Divergence from reference

1. **RE-HOME (de-RAC)**: ref renders react-aria `Heading` (which itself renders `h{level}` and consumes `HeadingContext`); spec renders a plain `h{level}` element. Public face unchanged: `level` default 2, auto-size mapping, all variant props kept.
2. **`slot` prop dropped**: RAC context slot wiring is gone. No app usage of `slot` on `Heading` was found; consumers needing a slotted heading inside a RAC context (date cluster dialogs) use the date cluster's private RAC internals.
3. **`render` prop added** (base-ui `useRender` + `mergeProps`) — the ref had no polymorphism; per library convention this becomes a canonical polymorphic text primitive. Never an `as` prop.
4. **`destructive` → `error` class rename**: value name kept (consumer compat), class becomes `text-error` per conventions (no `destructive` classes in library source).
5. **`HeadingProps` name**: unchanged from ref (already unique) — recorded here because its siblings rename (text.md/span.md §8: the ref exports three colliding `TextProps`).
6. **`align` axis surfaced**: present in the ref recipe but not in the component's destructured props; spec documents it as a first-class prop.
7. **`data-slot="heading"` added**; `displayName` kept.

## 9 Test requirements

- `getByRole("heading", { level: 2 })` by default; `level={1}`…`level={6}` each yield the matching role level and tag name.
- Auto-size: `level={1}` resolves `text-2xl`, `level={2}` `text-lg`, `level={3}` `text-base`; explicit `size="4xl"` overrides the mapping at any level.
- Each `variant` resolves its class (parametrized); `destructive` resolves `text-error` and never a `destructive` class.
- `noMargin`/`uppercase`/`align` toggle their classes; `className` merge wins via `cn`.
- `render` prop: renders the provided element with merged recipe classes.
- `headingVariants` unit: defaults resolve `variant/size/font: default`; output has no raw palette classes and no `dark:` variants.

## 10 Demo requirements

Plain runnable `.tsx` demos: `heading-basic.tsx` (levels 1–6 with auto sizes — the type scale ladder), `heading-sizes.tsx` (all 9 sizes at a fixed level, showing size/level decoupling), `heading-variants.tsx` (color variants incl. muted/brand on a surface), `heading-modifiers.tsx` (font weights, uppercase, align, noMargin).
