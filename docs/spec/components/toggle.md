# Toggle

## 1 Header

- **Canonical name**: `Toggle` (single component); recipe `toggleVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/toggle` (also re-exported from `@elmeragroup/ui`); `toggleVariants` comes from the same entry
- **RSC**: client
- **Tier**: base-ui control primitive (a two-state pressed button; grouped usage goes through `ToggleGroup.Item`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/toggle.tsx`

## 2 Anatomy

Single element wrapping `Toggle` from `@base-ui/react/toggle` (renders a `<button aria-pressed>`; `render` prop available for polymorphism per base-ui `useRender`).

```tsx
<Toggle aria-label="Bold" pressed={bold} onPressedChange={setBold}>
  <TextB data-icon="inline-start" aria-hidden />
</Toggle>
```

## 3 Props

`Omit<ComponentProps<typeof TogglePrimitive>, "className"> & { className?: string } & VariantProps<typeof toggleVariants>` — full primitive pass-through (`pressed`, `defaultPressed`, `onPressedChange`, `disabled`, `value`, `render`, native button props). The ref's `className` re-widening to plain `string` (the primitive accepts a state-callback className; the wrapper narrows it for `cn`) is kept.

| Prop        | Type                                | Default     | Notes                                        |
| ----------- | ----------------------------------- | ----------- | -------------------------------------------- |
| `variant`   | `"default" \| "outline"`            | `"default"` | tv axis                                      |
| `size`      | `"xs" \| "sm" \| "default" \| "lg"` | `"default"` | tv axis                                      |
| `className` | `string`                            | —           | merged via tv's `className` slot inside `cn` |
| …rest       | `TogglePrimitive` props             | —           | spread onto the primitive                    |

## 4 Variants

Recipe: **`toggleVariants`** — **PUBLIC**. The ref exports it and `ToggleGroup.Item` borrows it; this is the sanctioned borrow pattern (same as `buttonVariants`), so it stays exported and typed via `VariantProps`.

| Axis      | Values                                                                                                 | Default   |
| --------- | ------------------------------------------------------------------------------------------------------ | --------- |
| `variant` | `default` (transparent bg) · `outline` (`border border-input bg-transparent shadow-xs hover:bg-muted`) | `default` |
| `size`    | see density mapping below                                                                              | `default` |

Base notes:

- **Pressed state, belt-and-braces**: base carries both `aria-pressed:bg-muted` **and** `data-pressed:bg-muted`. base-ui emits both `aria-pressed` and `data-pressed`; the doubled selector is kept deliberately so the style survives either channel (and consumer `render`-prop substitutions that only forward aria).
- **Icon-padding hooks**: every size defines `has-data-[icon=inline-start]:pl-(--control-px-icon-*)` / `has-data-[icon=inline-end]:pr-(--control-px-icon-*)` — consumers tag icon children with `data-icon="inline-start" | "inline-end"` and the button tightens padding on that side.
- Icon sizing guard: `[&_svg:not([class*='size-'])]:size-4` (xs: `size-3`); `[&_svg]:pointer-events-none [&_svg]:shrink-0`.
- Press feedback `active:scale-[0.96]` with `transition-[color,box-shadow,scale]`.

**Density mapping.** Toggle `size` selects a shared density rung per [conventions](conventions.md). Recipes read `--control-*` implementation variables; do not add `dense:` / `comfortable:` variants. Keep the xs radius clamp.

| Toggle `size` | Density rung | Notes                                                                                                                                                                         |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xs`          | `xs`         | `h-(--control-h-xs) min-w-(--control-h-xs) gap-(--control-gap-xs) px-(--control-px-xs)`; type stays `text-xs`; radius `rounded-[min(var(--radius-md),10px)]`; icons `size-3`. |
| `sm`          | `sm`         | `h-(--control-h-sm) min-w-(--control-h-sm) gap-(--control-gap-sm) px-(--control-px-sm)`; type is size-owned (`text-sm`).                                                      |
| `default`     | `md`         | Pins `h-(--control-h-md) min-w-(--control-h-md) gap-(--control-gap-md) px-(--control-px-md)` plus the control-type pair.                                                      |
| `lg`          | `lg`         | `h-(--control-h-lg) min-w-(--control-h-lg) gap-(--control-gap-lg) px-(--control-px-lg)` plus the control-type pair.                                                           |

## 5 Consumed tokens

- `muted` / `foreground` — hover and pressed fills (`hover:bg-muted hover:text-foreground`, pressed `bg-muted`).
- `input` — outline variant border.
- `ring` — shared `focusRing({ target: "self" })`; no local focus classes.
- `error` — invalid border + ring (`aria-invalid:border-error aria-invalid:ring-error/20`).

## 6 Data attributes

**Emitted**: `data-slot="toggle"`; base-ui emits `data-pressed` (and `aria-pressed`) when on. Root carries `group/toggle` scope for consumer child styling.

**Consumed**: `data-pressed`/`aria-pressed` (pressed fill), `aria-invalid` (error styles), `data-icon="inline-start" | "inline-end"` on children (padding hooks), `disabled` (`pointer-events-none opacity-50`).

## 7 Accessibility

- Native `<button>` with `aria-pressed` managed by base-ui — a true toggle button, not a checkbox.
- Keyboard: Space/Enter toggle; Tab in/out. Nothing hand-written.
- Focus is `focus-visible`-scoped.
- Icon-only usage requires a consumer-supplied `aria-label` (demos must show it).

## 8 Divergence from reference

1. **Focus unified:** the ref's local three-pixel ring becomes shared `focusRing({ target: "self" })` with the library-wide two-pixel ring and offset.
2. **`dark:` variant class dropped** (`dark:aria-invalid:ring-destructive/40`) per `no-tailwind-dark-variant`.
3. **`destructive` → `error`** token rename on `aria-invalid:` classes.
4. Kept as-is, documented (not divergences): the doubled `aria-pressed:` + `data-pressed:` selectors, the `has-data-[icon=…]` padding hooks, and the xs `rounded-[min(var(--radius-md),10px)]` radius clamp.
5. **Density retokenization:** size-axis height, min-width, inline padding, icon-edge padding, gap, and `md`/`lg` type read `--control-*` instead of the ref's literal `h-6`/`h-8`/`h-9`/`h-10` ladder. Dense computed metrics match the ref; comfortable is the signed `ui.css` column.

No API divergence — prop surface and the public `toggleVariants` export are identical to the ref.

## 9 Test requirements

- `getByRole("button", { pressed: false })` renders; clicking flips to `{ pressed: true }` and fires `onPressedChange(true)`.
- Keyboard: Tab focuses, Space and Enter each toggle; `disabled` blocks toggling and tab order.
- Controlled (`pressed` + `onPressedChange`) and uncontrolled (`defaultPressed`) both work.
- `data-pressed` and `aria-pressed` both reach the DOM when on.
- Variant/size render without leaking invalid classes; `data-icon="inline-start"` child triggers the tightened padding class (assert via class state, not snapshot).
- `toggleVariants` unit: default axes resolve to `variant: default`, `size: default`; each size string reads the matching `--control-h-*` variable, not a literal `h-*`.
- Dual-density: at document `dense` and `comfortable`, computed height, min-width, inline padding, icon-edge padding, and gap match the signed ladder for every mapped rung; font-size and line-height match on `default` and `lg`; `xs`/`sm` type is identical across densities; nested `data-density` and `ThemeScope` variant changes do not rescope metrics.

## 10 Demo requirements

Plain runnable `.tsx` demos: `toggle-basic.tsx` (icon + label, uncontrolled), `toggle-variants.tsx` (default vs outline), `toggle-sizes.tsx` (xs/sm/default/lg), `toggle-icon-only.tsx` (aria-label, `data-icon` hooks), `toggle-controlled.tsx` (controlled pressed state).
