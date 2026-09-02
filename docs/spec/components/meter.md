# Meter

## 1 Header

- **Canonical name**: `Meter` (single component with a composite face — label row + track baked in); constants `METER_CONSTANTS` (public)
- **Export path**: `@elmeragroup/ui/meter` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — wraps the base-ui Meter primitive
- **Tier**: labeled composite over `@base-ui/react/meter` (read-only value display — never an input)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/meter.tsx`, `.ref/OrderModuleInternalWeb/packages/ui/src/constants/meter-constants.ts`, `.ref/OrderModuleInternalWeb/packages/ui/src/styles/meter.ts`

## 2 Anatomy

One export rendering five internal parts (not consumer-composable):

| Internal part                              | base-ui primitive               | data-slot (ours, see §8)     |
| ------------------------------------------ | ------------------------------- | ---------------------------- |
| root                                       | `Meter.Root`                    | `meter`                      |
| label row                                  | `<div>` + `Meter.Label`         | `meter-label` (on the Label) |
| value (icon + `valueLabel ?? Meter.Value`) | `<span>` wrapping `Meter.Value` | `meter-value`                |
| track                                      | `Meter.Track`                   | `meter-bar`                  |
| indicator                                  | `Meter.Indicator`               | `meter-bar-fill`             |

An internal `MeterIcon` renders a status icon inside the value span; internal `getMeterLevel(value, maxValue, percentage)` derives the level.

```tsx
<Meter label="Storage used" value={82} maxValue={120} mode="success-only-when-full" />
```

## 3 Props

`MeterProps = { label?, mode?, value, minValue?, maxValue?, valueLabel?, className? } & Omit<ComponentProps<typeof MeterPrimitive.Root>, "value" | "min" | "max" | "className" | "locale">`.

| Prop           | Type                                                      | Default           | Notes                                                                                                                                               |
| -------------- | --------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`        | `number`                                                  | — (required)      | current value                                                                                                                                       |
| `minValue`     | `number`                                                  | `0`               | labeled-composite naming (ref-verbatim; the `min`/`max` → `minValue`/`maxValue` rename is the composite-tier convention). Mapped to primitive `min` |
| `maxValue`     | `number`                                                  | `100`             | mapped to primitive `max`; also drives `EXCEEDED_MAX_VALUE` (only when explicitly provided)                                                         |
| `label`        | `string`                                                  | —                 | rendered in `Meter.Label`                                                                                                                           |
| `valueLabel`   | `ReactNode`                                               | —                 | replaces the auto-formatted `<Meter.Value />`                                                                                                       |
| `mode`         | `MeterMode`                                               | `"default"`       | see §4                                                                                                                                              |
| `warningLabel` | `string`                                                  | locale dictionary | accessible name for Warning icon                                                                                                                    |
| `successLabel` | `string`                                                  | locale dictionary | accessible name for CheckCircle icon                                                                                                                |
| `className`    | `string`                                                  | —                 | merged onto the root                                                                                                                                |
| …rest          | `Meter.Root` props minus `value/min/max/className/locale` | —                 | e.g. `format`, `getAriaValueText`; the implementation passes the provider locale to the primitive                                                   |

Percentage math: `max > min ? clamp(((value - min) / (max - min)) * 100, 0, 100) : 0`. Level: `value > maxValue` (explicit maxValue only) → `EXCEEDED_MAX_VALUE`; `percentage === 100` → `FULL`; `> 80` → `MEDIUM`; else `LOW`.

## 4 Variants

Recipe: **`meterVariants`** (slots: `root`, `labelContainer`, `labelValue`, `icon`, `bar`, `barFill`) — **stays module-private**; no borrow pattern exists. Axes: `mode` × `level`, resolved internally — `level` is never a prop.

Modes (`METER_CONSTANTS.MODES`): `default` (full bar = error colors), `inverted` (full bar = success colors), `success-only-when-full` (full = success, everything else = error), `neutral` (primary bar at every level, no semantics, no icon).

> **Note**: the mode value named `"inverted"` is a **mode name** describing flipped good/bad semantics. It is **unrelated** to the dropped `inverted:` custom Tailwind variant from the ref theme system (see input spec §8) — do not conflate them.

Full mode × level color matrix (`barFill` / `labelValue`), base level styles + compoundVariants applied:

| Level                                   | `default`                                | `inverted`                               | `success-only-when-full`      | `neutral`                        |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------- | ----------------------------- | -------------------------------- |
| `LOW` (≤80%)                            | `bg-success` / `text-success`            | `bg-error` / `text-error`                | `bg-error` / `text-error`     | `bg-primary` / `text-foreground` |
| `MEDIUM` (>80%)                         | `bg-warning` / `text-warning-foreground` | `bg-warning` / `text-warning-foreground` | `bg-error` / `text-error`     | `bg-primary` / `text-foreground` |
| `FULL` (100%)                           | `bg-error` / `text-error`                | `bg-success` / `text-success`            | `bg-success` / `text-success` | `bg-primary` / `text-foreground` |
| `EXCEEDED_MAX_VALUE` (value > maxValue) | `bg-error` / `text-error`                | `bg-error` / `text-error`*               | `bg-error` / `text-error`*    | `bg-primary` / `text-foreground` |

\* falls through to the base level styles — the ref defines no `EXCEEDED_MAX_VALUE` compound for `inverted`/`success-only-when-full` (ref-faithful; arguably surprising for `inverted`, kept as-is).

Icon logic (`MeterIcon`): derived from the resolved `level`, never from the raw percentage. `default` mode → named `Warning` at every level above `LOW` (`MEDIUM`, `FULL`, `EXCEEDED_MAX_VALUE`, i.e. percentage > 80), nothing at `LOW` (exactly 80 shows no icon); `success-only-when-full` → named `CheckCircle` at `FULL`, `Warning` otherwise; **`inverted` and `neutral` → always `null`** (kept, documented — `inverted` gets colors but never an icon). _(Amended 2026-09-02, §8.8.)_

Fixed styling: track `h-1.5 rounded-full bg-muted` with transparent inset outline (forced-colors affordance); fill `transition-all forced-colors:bg-[Highlight]`; value span `text-sm tabular-nums`; label `text-sm font-medium`.

## 5 Consumed tokens

- `success` — LOW (`default`), FULL (`inverted`, `success-only-when-full`) fill/text.
- `warning` / `warning-foreground` — MEDIUM fill / MEDIUM value text (per canonical token contract, warning text uses `warning-foreground`).
- `error` — FULL/EXCEEDED (`default`), LOW (`inverted`, `success-only-when-full`) fill/text (ref's `bg-destructive`/`text-destructive`).
- `primary` / `foreground` — `neutral` mode fill / text.
- `muted` — track background.

## 6 Data attributes

**Emitted**: `data-slot="meter"` (root), `data-slot="meter-label"`, `data-slot="meter-bar"`, `data-slot="meter-bar-fill"`, `data-slot="meter-value"` — added per §8 bugfix (the ref emits none).

**Consumed**: none — all state (mode/level) is resolved in JS via tv, not via data-attribute selectors.

## 7 Accessibility

- base-ui `Meter.Root` renders `role="meter"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax` and `aria-valuetext` (customizable via `format`/`getAriaValueText` pass-through).
- `Meter.Label` is auto-associated with the root (`aria-labelledby`).
- Read-only — no keyboard interaction surface.
- Icons carry localized accessible names (`meter.warning`, `meter.success`) with explicit prop overrides; level color is never the sole signal in `default`/`success-only-when-full` because the icon accompanies every level above `LOW` (>80%). Forced-colors mode gets `bg-[Highlight]` on the fill.

## 8 Divergence from reference

1. **BUGFIX (ruled): `data-slot` attributes added** (`meter`, `meter-label`, `meter-bar`, `meter-bar-fill`, `meter-value`) — the ref Meter is the only component in the library emitting no `data-slot` at all; the omission is documented and corrected.
2. **Icons → Phosphor**: the reference alert/check-circle icons become named `Warning` / `CheckCircle` imports from `@elmeragroup/ui/icons`, regular weight.
3. **`destructive` → `error`** token renames throughout `meterVariants` (`bg-destructive` → `bg-error`, `text-destructive` → `text-error`).
4. Not divergences, ref-verbatim and documented: the `minValue`/`maxValue` prop names (composite-tier convention, already renamed in the ref); `meterVariants` staying private; `MeterIcon` returning `null` for `inverted`/`neutral`; the missing `EXCEEDED_MAX_VALUE` compounds noted in §4; the 80/100 level thresholds.
5. **Naming caution restated**: mode `"inverted"` ≠ the dropped `inverted:` Tailwind variant from the ref's theme system. The mode survives unchanged; the Tailwind variant does not exist in this library.
6. Hardcoded English icon labels become provider-locale dictionary defaults with `warningLabel`/`successLabel` overrides.
7. **Locale is provider-only:** the primitive's component-level `locale` prop is omitted from `MeterProps`; `useElmeraGroupUi().locale` drives both number formatting and the icon-label dictionary.
8. **One 80% boundary for fill and icon** — the ref's `MeterIcon` tested `percentage >= 80` while `getMeterLevel` tested `> 80`, so a meter at exactly 80% painted a `LOW` (success) fill under a `Warning` icon. The icon now derives from `level`: exactly 80 is `LOW` with no icon; the first `Warning` appears with the first `MEDIUM` fill. _(Ruled 2026-09-02, pending owner confirmation: `> 80` for both, matching the §9 `getMeterLevel` boundary test rather than moving the level to `≥ 80`.)_

No API divergence — `MeterProps` is identical to the ref.

## 9 Test requirements

- `getByRole("meter")` renders with `aria-valuenow`, `aria-valuemin` (default 0), `aria-valuemax` (default 100); `label` resolves as the accessible name.
- `valueLabel` replaces the formatted value; default renders base-ui's formatted `Meter.Value`.
- **`getMeterLevel` unit tests** (thresholds): percentage ≤ 80 → `LOW`; 80 < p < 100 → `MEDIUM` (boundary: exactly 80 is `LOW`); p === 100 → `FULL`; `value > maxValue` with explicit `maxValue` → `EXCEEDED_MAX_VALUE`; no explicit `maxValue` → never `EXCEEDED_MAX_VALUE`; `max <= min` → percentage 0 → `LOW`.
- Mode × level classes: spot-check each column of the §4 matrix via the emitted `data-slot="meter-bar-fill"` element's classes.
- Icon behavior under an `ElmeraGroupUiProvider locale="en-US"`: `default` at 79% → no icon; at 85% → Warning (`getByLabelText("Warning")`); `success-only-when-full` at 100% → CheckCircle (`getByLabelText("Success")`); `inverted`/`neutral` → no icon at any value.
- **Boundary (browser, by role/label)**: `default` at exactly 80% renders the `LOW` fill and no icon; at 81% the `MEDIUM` fill and the Warning icon appear together; a scaled `value={96} maxValue={120}` (80%) is likewise icon-free.
- Warning/success labels render in all four locales; explicit overrides win.
- All five `data-slot` attributes present.

## 10 Demo requirements

Plain runnable `.tsx` demos: `meter-basic.tsx` (label + value, default mode), `meter-modes.tsx` (all four modes side by side at LOW/MEDIUM/FULL/exceeded values), `meter-value-label.tsx` (custom `valueLabel`, e.g. "82 of 120 GB"), `meter-range.tsx` (custom `minValue`/`maxValue` + exceeded state), `meter-neutral.tsx` (neutral progress-like usage, no semantics).
