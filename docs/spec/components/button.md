# Button

## 1. Header

- **Canonical name:** `Button` — single component, no namespace.
- **Export path:** `@elmeragroup/ui/button` (also re-exported from `@elmeragroup/ui`); `buttonVariants` comes from the same entry. Its source recipe module remains runtime-free for package-private cross-component borrowing.
- **RSC:** client — pending/visually-disabled state and intent registration
- **Tier:** base-ui primitive wrapper.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/button.tsx` + `base-ui/button-variants.ts`.

## 2. Anatomy

Single part. Wraps `@base-ui/react/button` (`ButtonPrimitive`), which supplies native-button semantics and the `render` prop (per conventions: polymorphism via base-ui `useRender`/`render`, never `as`). Adds the variant recipe, pending/visually-disabled states, and predictive-intent wiring via `usePredictedEvents` + `useMergedRefs`.

## 3. Props

`ButtonProps` is a **union of two branches** over one shared surface, `Omit<ComponentProps<typeof ButtonPrimitive>, "className"> & Omit<VariantProps<typeof buttonVariants>, "size"> & { … }`:

- **label branch** — `size?: LabelButtonSize` (`default`, `xs`, `sm`, `lg`), no label requirement;
- **icon-only branch** — `size: IconButtonSize` (`Extract<ButtonSize, "icon" | \`icon-…\`>`: `icon`, `icon-xs`, `icon-sm`, `icon-lg`, `icon-inline`) **plus a required `aria-label: string`**.

An `icon*` size without `aria-label` is a compile error; that is the mechanical half of the [accessibility](../accessibility.md) §3 icon-only rule. Consumers that re-wrap Button and own the name themselves distribute the `Omit` over both branches (`PopoverInfoButton` does).

| Prop                 | Type                     | Default     | Notes                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`            | see §4                   | `"default"` | Recipe axis.                                                                                                                                                                                                                                                |
| `size`               | see §4                   | `"default"` | Recipe axis. An `icon*` value selects the icon-only branch above and makes `aria-label` required.                                                                                                                                                           |
| `aria-label`         | `string`                 | —           | **Required** on the icon-only branch (`size` starts with `icon`); optional elsewhere as an ordinary ARIA pass-through.                                                                                                                                      |
| `className`          | `string`                 | —           | Merged last via `cn`.                                                                                                                                                                                                                                       |
| `disabled`           | `boolean`                | `false`     | Base-ui naming (primitive tier). Effective disabled is `disabled \|\| isPending`.                                                                                                                                                                           |
| `isVisuallyDisabled` | `boolean`                | `false`     | Adds `opacity-70` and calls `event.preventDefault()` in `onMouseDown` (suppresses focus-on-press) while the button **stays interactive** — click, keyboard, and focus-visible all still work. For "looks disabled but explains itself on activation" flows. |
| `isPending`          | `boolean`                | `false`     | Sets `disabled` on the element **and** emits `data-pending`. Blocks activation entirely.                                                                                                                                                                    |
| `onIntent`           | `() => void`             | —           | Predictive-prefetch callback; fires once when pointer trajectory is predicted to hit the button (see below).                                                                                                                                                |
| `predictionZoneSize` | `number`                 | `30`        | Pixels the hit rect is inflated on every side for intent prediction.                                                                                                                                                                                        |
| `onMouseDown`        | `MouseEventHandler`      | —           | Wrapped; user handler runs after the visually-disabled `preventDefault`.                                                                                                                                                                                    |
| `ref`                | `Ref<HTMLButtonElement>` | —           | Merged with the prediction hook's ref (see below).                                                                                                                                                                                                          |
| …rest                | `ButtonPrimitive` props  | —           | Includes `render` for polymorphism (link-buttons etc.).                                                                                                                                                                                                     |

**`onIntent` mechanics** (package-private registry + hooks): one shared document `pointermove` listener calls `event.getPredictedEvents()` and fires a registered callback once when a predicted point lands inside its inflated element bounds. The listener exists only while registrations exist. Enablement: `!disabled && !isPending && !isVisuallyDisabled && !!onIntent`. Browsers without the API fail soft. A package-private merged-ref helper preserves overlay-trigger refs. None of these helpers is exported.

## 4. Variants

Recipe: `buttonVariants` (`tv`) — **public**, runtime-free. Defaults: `variant: "default"`, `size: "default"`.

**Base:** `group/button` scope; inline-flex centered, `rounded-md`, transparent border, `bg-clip-padding`, `font-medium whitespace-nowrap`; transitions color/background/border/shadow/translate/opacity; composes `focusRing({ target: "self" })`; press feedback `active:not-aria-[haspopup]:translate-y-px` (suppressed for popup triggers); `disabled:pointer-events-none disabled:opacity-50`; invalid state `aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20`; svg children non-interactive, default `size-4`. Type is not on the base: `md`/`lg` consume `--control-text` / `--control-leading`; `sm` sets `text-sm`; `xs` sets `text-xs`.

| `variant`     | Classes (summary)                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/80`                                                                                                     |
| `outline`     | `border-border bg-background shadow-xs hover:bg-muted hover:text-foreground` + `aria-expanded:bg-muted aria-expanded:text-foreground` (open-trigger styling) |
| `secondary`   | `bg-secondary text-secondary-foreground`, hover via `color-mix(in oklch, var(--secondary), var(--foreground) 5%)`, `aria-expanded:` pins secondary colors    |
| `ghost`       | transparent; `hover:bg-muted hover:text-foreground` + `aria-expanded:bg-muted aria-expanded:text-foreground`                                                 |
| `destructive` | **Tinted, not solid — deliberate, kept:** `border-error/20 bg-error/10 text-error hover:border-error hover:bg-error/20`; focus stays canonical               |
| `success`     | Same tinted pattern on success tokens: `border-success/20 bg-success/10 text-success hover:border-success hover:bg-success/20`; focus stays canonical        |
| `link`        | `text-primary underline-offset-4 hover:underline`                                                                                                            |

| `size`        | Classes (summary)                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`     | `h-(--control-h-md) gap-(--control-gap-md) px-(--control-px-md)` plus `[font-size:var(--control-text)] [line-height:var(--control-leading)]`; icon-padding hooks `has-data-[icon=inline-start]:pl-(--control-px-icon-md)` / `has-data-[icon=inline-end]:pr-(--control-px-icon-md)` |
| `xs`          | `h-(--control-h-xs) gap-(--control-gap-xs) px-(--control-px-xs) text-xs rounded-[min(var(--radius-md),8px)]`; svg `size-3`; icon hooks `pl-(--control-px-icon-xs)` / `pr-(--control-px-icon-xs)`                                                                                   |
| `sm`          | `h-(--control-h-sm) gap-(--control-gap-sm) px-(--control-px-sm) text-sm rounded-[min(var(--radius-md),10px)]`; icon hooks `pl-(--control-px-icon-sm)` / `pr-(--control-px-icon-sm)`                                                                                                |
| `lg`          | `h-(--control-h-lg) gap-(--control-gap-lg) px-(--control-px-lg)` plus the control-type pair; icon hooks `pl-(--control-px-icon-lg)` / `pr-(--control-px-icon-lg)`                                                                                                                  |
| `icon`        | `size-(--control-h-md)`                                                                                                                                                                                                                                                            |
| `icon-xs`     | `size-(--control-h-xs) rounded-[min(var(--radius-md),8px)]`; svg `size-3`                                                                                                                                                                                                          |
| `icon-sm`     | `size-(--control-h-sm) rounded-[min(var(--radius-md),10px)]`                                                                                                                                                                                                                       |
| `icon-inline` | `hit-area-1 aspect-square h-lh w-auto` — line-height-sized inline icon button with expanded hit area                                                                                                                                                                               |
| `icon-lg`     | `size-(--control-h-lg)`                                                                                                                                                                                                                                                            |

Sizes `default`, `xs`, `sm`, `icon-xs`, `icon-sm` add `in-data-[slot=button-group]:rounded-md` — inside a ButtonGroup the radius clamp is dropped so the group's own edge-rounding rules govern corners.

**Density mapping.** Button `size` selects a shared density rung per [conventions](conventions.md). Recipes read `--control-*` implementation variables; do not add `dense:` / `comfortable:` variants.

| Button `size`     | Density rung | Notes                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xs`, `icon-xs`   | `xs`         | Type stays `text-xs`. Icon-only uses the `xs` height as a square.                                                                                                                                                                                                                                       |
| `sm`, `icon-sm`   | `sm`         | Type is size-owned. The `sm` variant **sets `text-sm` itself** so it does not inherit `--control-text`. Icon-edge padding on this rung is distinct; it is not a uniform `base − 2px` derivation.                                                                                                        |
| `default`, `icon` | `md`         | Default size **pins height** with `h-(--control-h-md)`. The size value is never an empty class list and is never content-sized. Do not also set `py-*` on this rung. Text `default` reads height, inline padding, icon-edge padding, gap, font-size, and line-height from `md` / the control-type pair. |
| `lg`, `icon-lg`   | `lg`         | Text `lg` maps type to the control-type pair. Icon-only uses the `lg` height as a square.                                                                                                                                                                                                               |
| `icon-inline`     | none         | Line-height sizing plus `hit-area-*` is density-independent geometry.                                                                                                                                                                                                                                   |

## 5. Consumed tokens

`primary`/`primary-foreground`, `secondary`/`secondary-foreground`, `muted`, `background`, `foreground`, `border`, `ring`, `error` (tinted `/10 /20 /40` opacities), `success` (same tints). Radius: `rounded-md` from `--radius`; the xs/sm clamps `min(var(--radius-md), 8px)` and `min(var(--radius-md), 10px)` are **kept and locked** — small buttons never exceed 8/10 px corner radius even under large-radius themes. No raw palette classes; no `dark:` variants (dark axis lives in tokens).

## 6. Data attributes

**Emitted:** `data-slot="button"` (layout contract consumed by ButtonGroup, InputGroup, etc.); `data-pending` (present only while `isPending`).
**Consumed:** `in-data-[slot=button-group]` (ancestor ButtonGroup → drop radius clamp); `has-data-[icon=inline-start]` / `has-data-[icon=inline-end]` (child icon markers → tightened padding on the icon side); `aria-expanded` (open overlay trigger → pinned hover-style background on `outline`/`secondary`/`ghost`); `aria-invalid` / `aria-haspopup` (base classes above).

## 7. Accessibility

- Native `<button>` semantics via base-ui: Enter and Space activate; `disabled`/`isPending` block activation.
- `isPending` uses real `disabled` — no ghost clicks mid-mutation. `isVisuallyDisabled` deliberately does **not** set `disabled` or `aria-disabled`: it only dims and suppresses focus-on-mousedown, keeping the control reachable and activatable (consumer decides what activation does).
- Focus: `focus-visible` ring only; mousedown-focus suppressed when visually disabled.
- `render`-prop polymorphism must preserve role/keyboard semantics (base-ui `useRender` + `mergeProps`).

## 8. Divergence from reference

1. **Token rename (LOCKED):** the `destructive` **variant value is kept** as the consumer-facing name, but its classes move from `destructive` tokens to canonical `error` tokens (`bg-error/10`, `text-error`, …) per conventions (`destructive` classes are consumer-compat aliases, never library source). Base `aria-invalid:` classes likewise move to `error`.
2. **`dark:` variants removed** (ref has `dark:bg-input/30`, `dark:aria-invalid:…`, etc.) — forbidden by `no-tailwind-dark-variant`; dark values live behind `[data-theme="dark"]` tokens.
3. **Kept deliberately:** `isVisuallyDisabled`, `isPending`, `onIntent`/`predictionZoneSize`, tinted (non-solid) `destructive`/`success` variants, radius clamps, public `buttonVariants`.
4. No namespace conversion — Button is a single component; no flat-export renames.
5. **Icon-only `aria-label` is type-enforced** (2026-09-03): `ButtonProps` ships as a two-branch union instead of the ref's flat intersection, so an `icon*` size cannot compile without `aria-label` ([accessibility](../accessibility.md) §3). §3 documented the flat intersection until this date; the union has shipped since the component landed, and the text is corrected to it, not the type relaxed.
6. **Density retokenization:** size-axis height, inline padding, icon-edge padding, gap, and `md`/`lg` type read `--control-*` implementation variables instead of the ref's literal `h-9` / `px-2.5` / `text-sm` ladder. Dense computed metrics match the ref; comfortable is the new column. `sm` sets `text-sm` itself. `icon-inline` stays density-independent.

## 9. Test requirements

Role-based queries only (`getByRole("button", { name })`).

- Enter and Space activate; `onClick` fires once per activation.
- `disabled` and `isPending` both block click and keyboard activation; `isPending` emits `data-pending` and `disabled` attr.
- `isVisuallyDisabled`: still activatable by click and keyboard; mousedown does not move focus; `opacity-70` class applied; no `disabled`/`aria-disabled`.
- `onIntent`: fires once when a predicted pointer path enters the inflated rect; never fires when `disabled`/`isPending`/`isVisuallyDisabled`; external `ref` still receives the element when `onIntent` is set (merged-ref regression test).
- `variant`/`size` render expected recipe classes; `render` prop swaps the tag while keeping role.
- Built stylesheet: at document `dense` and `comfortable`, computed height, inline padding, icon-edge padding, and gap match the signed ladder for every mapped rung; font-size and line-height match on `default` and `lg`; `xs`/`sm` type is identical across densities; `icon-inline` is density-independent; smallest square rung is at least 24×24 CSS px. Nested `data-density` and `ThemeScope` variant changes do not rescope metrics.

## 10. Demo requirements

Plain runnable `.tsx` demos, one per scenario:

- `button-variant-matrix.tsx` — all 7 variants × default size, incl. tinted destructive/success.
- `button-sizes.tsx` — all 9 sizes with icon-padding hooks (`data-icon="inline-start"`/`"inline-end"` children).
- `button-pending.tsx` — `isPending` with `SpinnerGap` (Phosphor) spinner.
- `button-visually-disabled.tsx` — `isVisuallyDisabled` explaining itself on activation.
- `button-predictive-intent.tsx` — `onIntent` prefetch with a visible "prefetched" indicator and adjustable `predictionZoneSize`.
