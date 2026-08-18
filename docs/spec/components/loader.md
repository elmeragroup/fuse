# Loader

## 1 Header

- **Canonical name**: `Loader` (single component, no namespace)
- **Export path**: `@elmeragroup/ui/loader` (also re-exported from `@elmeragroup/ui`); `loaderVariants` comes from the same entry
- **RSC**: server
- **Tier**: plain-element leaf (styled div + spinning icon; no base-ui primitive, no client state)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/loader.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/styles/loader.ts`

## 2 Anatomy

| Part | Renders | Notes |
| --- | --- | --- |
| `Loader` | `<div role="status">` containing a spinning `<SpinnerGap />` | icon carries `animate-spin`; wrapper centers with `p-4` |

```tsx
<Loader size="medium" aria-label={t("loading")} />
```

## 3 Props

`LoaderProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof loaderVariants>`:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"default"` | `"default"` | single-value axis, kept for future variants (§4) |
| `size` | `"default" \| "small" \| "medium" \| "large" \| "xl"` | `"default"` | icon size only; wrapper padding is constant |
| `aria-label` | `string` | — | consumer-supplied accessible name (no baked English — i18n) |

`className` merges onto the wrapper via `cn`; all other div props pass through.

## 4 Variants

Recipe: `loaderVariants` — **PUBLIC** (ref exports it; kept as a borrow surface for consumers composing their own pending states). Slot recipe (`tv` slots `base`, `icon`):

- `base`: `flex items-center justify-center p-4`; `icon`: `animate-spin`
- `variant`: **single value** `default` (`base: text-foreground`) — documented as intentionally single-valued; the axis exists so future variants (e.g. muted/inverse) are additive, not breaking
- `size`: `default → size-4`, `small → size-3`, `medium → size-6`, `large → size-8`, `xl → size-10` (icon slot only)
- defaults: `variant="default"`, `size="default"`

## 5 Consumed tokens

`foreground` (icon color via the default variant). Nothing else — no backgrounds, borders, or radii.

## 6 Data attributes

**Emitted**: `data-slot="loader"` on the wrapper (added; ref emits none). No state attributes.

**Consumed**: none.

## 7 Accessibility

- Wrapper renders `role="status"` — a polite live region announcing the loading state's presence.
- No default `aria-label` (no baked English); consumers pass a translated label. Without one the region is announced by role alone.
- The icon is decorative (`aria-hidden="true"`); motion comes from CSS `animate-spin`, which respects a consumer-level `prefers-reduced-motion` override in the theme layer.
- Not focusable; no keyboard behavior.

## 8 Divergence from reference

1. **Icon → Phosphor (LOCKED)**: the reference lucide `Loader2` becomes the named `SpinnerGap` import from `@elmeragroup/ui/icons`, the canonical spin-animation swap.
2. **`loaderVariants` stays PUBLIC** — ref exports it from both `styles/loader.ts` and `loader.tsx`; ours exports it once, alongside the component.
3. **Added a11y**: `role="status"` + `aria-hidden` icon + `data-slot="loader"` (ref renders a bare, AT-invisible div).
4. **Single-value `variant` axis kept verbatim** — deliberately not collapsed; see §4.

## 9 Test requirements

- `getByRole("status")` finds the loader; with `aria-label` it is `getByRole("status", { name })`.
- The icon is `aria-hidden` and carries `animate-spin`.
- Each `size` value maps to its icon size class; `className` merges onto the wrapper.
- `loaderVariants` is importable from the package root and returns `base`/`icon` slot functions (public-recipe guard).

## 10 Demo requirements

`loader-sizes.tsx` (all five sizes in a row), `loader-inline.tsx` (loader inside a card/pending panel with a translated `aria-label`).
