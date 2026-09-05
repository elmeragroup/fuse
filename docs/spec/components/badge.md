# Badge

## 1 Header

- **Canonical name**: `Badge` (single component); recipe `badgeVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/badge` (also re-exported from `@elmeragroup/ui`); `badgeVariants` comes from the same entry
- **RSC**: server
- **Tier**: styled display primitive (plain `div`; no base-ui primitive)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/badge.tsx` + `styles/badge.ts`

## 2 Anatomy

Single `div` styled by `badgeVariants`.

```tsx
<Badge variant="success" size="sm">
  Active
</Badge>
```

## 3 Props

`BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>` — exported type, kept from ref.

| Prop        | Type                        | Default     | Notes                   |
| ----------- | --------------------------- | ----------- | ----------------------- |
| `variant`   | 14 values, see §4           | `"default"` | tv axis                 |
| `size`      | `"sm" \| "default" \| "lg"` | `"default"` | tv axis                 |
| `className` | `string`                    | —           | merged via `cn`         |
| …rest       | native `div` props          | —           | spread onto the element |

## 4 Variants

Recipe: **`badgeVariants`** — **PUBLIC**. The external ref exported it and `checkbox-card` borrows it for its tag chips (see checkbox-card.md); sanctioned borrow pattern, stays exported and typed via `VariantProps`.

| Axis      | Values                                                                                                                                                                                                        | Default   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `variant` | `default` · `secondary` · `destructive` · `success` · `warning` · `info` · `outline` · `outline-secondary` · `outline-destructive` · `outline-success` · `outline-warning` · `muted` · `accent` · `card` (14) | `default` |
| `size`    | `sm` (`px-2 py-px text-xs`) · `default` (`px-2.5 py-0.5 text-xs`) · `lg` (`px-3 py-1 text-sm`)                                                                                                                | `default` |

Variant notes:

- Filled variants: `border-transparent bg-{token} text-{token}-foreground shadow-xs hover:bg-{token}/80` (secondary omits `shadow-xs`, per ref).
- `destructive` / `outline-destructive` **keep their value names** (consumer-facing compat) but their classes are renamed to `error` tokens (§8).
- **`info` — sanctioned `color-mix`**: `border-[color-mix(in_oklch,var(--info)_16%,transparent)] bg-[color-mix(in_oklch,var(--info)_8%,transparent)] text-info-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--info)_16%,transparent)]`. The arbitrary values are **token-derived** (`var(--info)` mixed to 8/16% alpha in oklch) — KEPT and documented as a sanctioned exception to the arbitrary-value ban; it does not trip `no-primitive-colors` because no raw palette appears.
- `outline` = `text-foreground` (bare base border); `outline-{status}` variants are border+text with hover fill inversion.
- Every size carries `[&>span]:text-{xs|sm} [&>span]:font-medium` span-normalizing hooks — kept from ref.
- Base: `inline-flex items-center rounded-lg border font-medium transition-colors`. Badge is deliberately non-interactive and carries no focus styling; consumers needing an actionable pill compose `Button`/`Link` instead of making a Badge focusable.

## 5 Consumed tokens

- `primary` / `secondary` / `muted` / `accent` / `card` + `-foreground` pairs — filled surfaces.
- `error` / `success` / `warning` + `-foreground` — status fills and outline borders (`error` via the destructive-named variants).
- `--info` / `info-foreground` — the `info` variant's color-mix derivations.
- `foreground` — `outline` variant text.
- `--radius` — `rounded-lg`.

## 6 Data attributes

**Emitted**: `data-slot="badge"` (added in spec — §8; the ref emits none).

**Consumed**: none.

## 7 Accessibility

- Non-interactive, non-focusable `div`; conveys status visually only. Consumers pairing color with meaning must include text (all variants carry text by design).
- Not announced as anything — no implicit role. If a badge must be live-updating status, the consumer wraps it in an `aria-live` region.
- No keyboard behavior.

## 8 Divergence from reference

1. **`destructive` → `error` class renames**: the `destructive` and `outline-destructive` variant **value names are kept** (they exist in the ref API and consumers pass them), but their classes move to canonical tokens: `bg-destructive`→`bg-error`, `text-destructive-foreground`→`text-error-foreground`, `border-destructive`→`border-error`, `text-destructive`→`text-error`, `hover:bg-destructive`→`hover:bg-error`. Per conventions, `destructive` classes never appear in library source; the value names survive as consumer-compat aliases.
2. **`data-slot="badge"` added** — the ref badge emits no data-slot (unique among internal-ref components); normalized to the family convention.
3. **`info` color-mix kept** — documented as sanctioned token-derived arbitrary values (see §4), not a divergence but recorded here as an explicit ruling.
4. `badgeVariants` publicity: the internal ref does **not** export `badgeVariants` from `badge.tsx` (only via `styles/`); the external ref exported it and checkbox-card borrows it — spec exports it publicly.
5. **Legacy focus classes removed:** the ref styled bare `:focus` on a non-interactive `div`, contradicting the shared `focus-visible` rule and implying Badge could be used as a control. It cannot; use an interactive primitive.

No other API divergence — prop surface identical to ref.

## 9 Test requirements

- Renders children text; `getByText` reachable; element carries `data-slot="badge"` (slot audit).
- Each of the 14 variants resolves classes in the unit recipe test (parametrized): `destructive` resolves to `bg-error` classes and never a `destructive` class; `info` resolves to the `color-mix` classes. Browser asserts computed surfaces from role tokens, not class strings. _(Amended 2026-09-04 — spec 07 / [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_
- Sizes: `sm`/`default`/`lg` each contain their padding/text classes in the unit recipe test; browser asserts computed padding/type scale.
- `className` merge wins over recipe conflicts via `cn` (unit); browser asserts the winning computed fill.
- `badgeVariants` unit: defaults resolve to `variant: default, size: default`; output contains no raw palette classes and no `dark:` variants.

## 10 Demo requirements

Plain runnable `.tsx` demos: `badge-basic.tsx` (default), `badge-variants.tsx` (all 14 in a grid, filled vs outline rows), `badge-status.tsx` (success/warning/info/destructive on realistic order statuses), `badge-sizes.tsx` (sm/default/lg).
