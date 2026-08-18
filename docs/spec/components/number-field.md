# NumberField

## 1 Header

- **Canonical name:** `NumberField`
- **Export path:** `@elmeragroup/ui/number-field`
- **Tier:** labeled composite over `@base-ui/react/number-field`
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/number-field.tsx`

## 2 Anatomy

```
Field.Root                              (base-ui Field.Root, gap-1)
├─ label row (div)                      — rendered when label || isPending || isSuccess
│  ├─ Field.Label                       — when `label`
│  ├─ Icon.SpinnerGap (animate-spin)    — when isPending
│  └─ Icon.Check                        — when isSuccess
├─ NumberField.Root                     (base-ui NumberField.Root)
│  └─ NumberField.Group                 (bordered field box; carries aria-invalid)
│     ├─ NumberField.Input              (tabular-nums)
│     ├─ denomination (div)             — when `denomination` (e.g. "kr", "kWh")
│     └─ stepper column (div, border-s)
│        ├─ NumberField.Increment > Icon.CaretUp (aria-hidden)
│        └─ NumberField.Decrement > Icon.CaretDown (aria-hidden)
├─ Field.Description                    — when `description`
└─ Field.Error                          — renders only when errorMessage is truthy
```

## 3 Props

**Closed prop list — deliberate.** No `...props` spread onto the input or root; only the props below exist. This keeps the base-ui NumberField surface (locale, snap, wheel behavior, etc.) out of the public API until needed.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | — | |
| `description` | `string` | — | |
| `errorMessage` | `ReactNode` | — | Renders `Field.Error` only when truthy |
| `isPending` | `boolean` | `false` | Spinner in label row |
| `isSuccess` | `boolean` | `false` | Check in label row (no crossfade here; both may render side by side) |
| `isInvalid` | `boolean` | `false` | → `Field.Root invalid`; Group gets `aria-invalid` |
| `isDisabled` | `boolean` | `false` | → `NumberField.Root disabled`; Group gets `bg-muted` |
| `isReadOnly` | `boolean` | `false` | → `NumberField.Root readOnly`; Group gets `bg-muted` |
| `isRequired` | `boolean` | `false` | → `NumberField.Root required` |
| `denomination` | `string` | — | Unit suffix rendered between input and steppers |
| `value` | `number` | — | Controlled; see controlled/NaN handling below |
| `defaultValue` | `number` | — | Uncontrolled initial value |
| `onChange` | `(value: number) => void` | — | **Empty input reports `NaN`** — kept contract (see below) |
| `minValue` | `number` | — | → base-ui `min` |
| `maxValue` | `number` | — | → base-ui `max` |
| `step` | `number` | — | |
| `formatOptions` | `Intl.NumberFormatOptions` | — | → base-ui `format` |
| `name` | `string` | — | |
| `className` | `string` | — | Merged onto the root |
| `aria-label` | `string` | — | Forwarded to the input (for label-less usage) |
| `autoFocus` | `boolean` | — | Forwarded to the input |
| `id` | `string` | — | Forwarded to `NumberField.Root` |

**onChange NaN-for-empty contract (kept):** base-ui reports `null` for a cleared input; this component maps it to `NaN` (`onChange?.(next ?? NaN)`) so consumers keep the legacy "empty is NaN" contract. Symmetrically, when controlled without a `defaultValue`, an incoming `value` of `null`/`NaN` is passed to base-ui as `null` (empty). When `defaultValue` is defined, `value` is passed through untouched.

## 4 Variants

No tv recipe and **no size axis** — the field box is a single fixed `h-9` styling; a module-private `stepperButton` class string is shared by Increment/Decrement. Nothing exported.

## 5 Consumed tokens

`card` (field-box surface — canonical replacement for the ref's `bg-white`), `input` (border), `ring` (focus-within border + `ring/50`), `error` (aria-invalid border + `error/20` ring — ref's `destructive`), `muted` (disabled/read-only fill, stepper hover/disabled fill), `muted-foreground` (denomination), `background` + `foreground` (stepper buttons). Radius `rounded-md`.

## 6 Data attributes

- **Emitted:** `data-slot="field"`, `data-slot="field-label"`, `data-slot="field-description"`, `data-slot="field-error"`; base-ui NumberField parts emit their own state attributes (`data-disabled`, `data-readonly`, `data-required`, `data-scrubbing` on Root/Group/Input per base-ui).
- **Consumed:** Group styles against its own `aria-invalid` (`aria-invalid:` variants); base-ui Field `data-invalid`/`data-disabled` available on the root.
- `aria-invalid` on the Group uses the `isInvalid || undefined` idiom — never `"false"` (conventions §API).

## 7 Accessibility

- Input is a `spinbutton`-pattern text input managed by base-ui: ArrowUp/ArrowDown step, PageUp/PageDown large-step, Home/End clamp to min/max; typed input is parsed per `formatOptions`.
- Increment/Decrement are buttons with base-ui-provided labels; the caret icons are `aria-hidden`.
- Field wiring (label/description/error ids) via base-ui Field; `Field.Error` has `role="alert"`.
- `aria-label` prop supports label-less fields; when `label` is set, Field.Label is the accessible name.
- `denomination` is visual-only (not part of the accessible name/value); consumers needing it announced should include the unit in `label` or `aria-label`.

## 8 Divergence from reference

1. **Icon swaps:** lucide `ChevronUp`/`ChevronDown` → Phosphor `CaretUp`/`CaretDown`; `Icon.Loader` → Phosphor `SpinnerGap`; `Icon.Check` → Phosphor `Check`.
2. **Token renames:** `destructive` → `error`; `bg-white` → `bg-card`; ref's `dark:bg-input/30` / `inverted:bg-input/30` dropped — dark axis lives in tokens.
3. **Kept as-is (documented, not divergence):** closed prop list; NaN-for-empty `onChange` contract; `aria-invalid` `x || undefined` idiom; no size axis; pending/success icons in the label row forcing the row to exist without a label (same caveat as TextField).

## 9 Test requirements

- Role/label queries: input by `getByRole("textbox", { name })` (base-ui renders a text input), steppers by `getByRole("button")`.
- Keyboard per §7: ArrowUp/ArrowDown change value by `step`; Home/End clamp to `minValue`/`maxValue`; typing then blur commits the parsed value.
- `onChange` fires with numbers; clearing the input fires `onChange(NaN)`.
- Clamping: values outside `minValue`/`maxValue` clamp on commit; steppers disable at bounds.
- `formatOptions` formatting round-trips (e.g. currency/percent display, numeric onChange).
- `isDisabled`/`isReadOnly`: steppers and input inert vs. read-only-focusable; `isInvalid` sets `aria-invalid` on the group and shows the alert when `errorMessage` present.
- Form integration: `name` submits the numeric value via the hidden input base-ui manages.

## 10 Demo requirements

Plain `.tsx` demos: `number-field-basic` (label, step, min/max), `number-field-denomination` (unit suffix), `number-field-format` (`formatOptions` currency/percent), `number-field-error` (isInvalid + errorMessage), `number-field-states` (disabled, read-only, pending/success), `number-field-uncontrolled` (defaultValue + NaN-on-clear logging).
