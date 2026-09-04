# NumberField

## 1 Header

- **Canonical name:** `NumberField`
- **Export path:** `@elmeragroup/ui/number-field`
- **RSC:** client
- **Tier:** labeled composite over `@base-ui/react/number-field`
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/number-field.tsx`

## 2 Anatomy

```
Field.Root                              (base-ui Field.Root, gap-1)
├─ label row (div)                      — rendered when label || isPending || isSuccess
│  ├─ Field.Label                       — when `label`
│  └─ pending/success indicator (div, size-3.5) — when isPending || isSuccess
│     ├─ SpinnerGap (named import, animate-spin, crossfade) — pending face
│     └─ Check (named import, crossfade)                    — success face
├─ NumberField.Root                     (base-ui NumberField.Root)
│  └─ NumberField.Group                 (bordered field box; carries aria-invalid)
│     ├─ NumberField.Input              (tabular-nums)
│     ├─ denomination (div)             — when `denomination` (e.g. "kr", "kWh")
│     └─ stepper column (div, border-s)
│        ├─ NumberField.Increment > CaretUp (named import, aria-hidden)
│        └─ NumberField.Decrement > CaretDown (named import, aria-hidden)
├─ Field.Description                    — when `description`
└─ Field.Error                          — renders only when errorMessage is truthy
```

## 3 Props

**Closed prop list — deliberate.** No `...props` spread onto the input or root; only the props below exist. Snap, wheel behavior, and the rest of base-ui's open surface stay out of the public API until needed. Locale is intentionally not public: the implementation reads `useElmeraGroupUi().locale` and passes it as `locale` to `NumberField.Root`, making the provider the sole locale source per ADR 0006.

| Prop            | Type                       | Default | Notes                                                          |
| --------------- | -------------------------- | ------- | -------------------------------------------------------------- |
| `label`         | `string`                   | —       |                                                                |
| `description`   | `string`                   | —       |                                                                |
| `errorMessage`  | `ReactNode`                | —       | Renders `Field.Error` only when truthy                         |
| `isPending`     | `boolean`                  | `false` | Spinner in label row                                           |
| `isSuccess`     | `boolean`                  | `false` | Check in label row; wins the crossfade over `isPending` (§8.7) |
| `isInvalid`     | `boolean`                  | `false` | → `Field.Root invalid`; Group gets `aria-invalid`              |
| `isDisabled`    | `boolean`                  | `false` | → `NumberField.Root disabled`; Group gets `bg-muted`           |
| `isReadOnly`    | `boolean`                  | `false` | → `NumberField.Root readOnly`; Group gets `bg-muted`           |
| `isRequired`    | `boolean`                  | `false` | → `NumberField.Root required`                                  |
| `denomination`  | `string`                   | —       | Unit suffix rendered between input and steppers                |
| `value`         | `number`                   | —       | Controlled; see controlled/NaN handling below                  |
| `defaultValue`  | `number`                   | —       | Uncontrolled initial value                                     |
| `onChange`      | `(value: number) => void`  | —       | **Empty input reports `NaN`** — kept contract (see below)      |
| `minValue`      | `number`                   | —       | → base-ui `min`                                                |
| `maxValue`      | `number`                   | —       | → base-ui `max`                                                |
| `step`          | `number`                   | —       |                                                                |
| `formatOptions` | `Intl.NumberFormatOptions` | —       | → base-ui `format`                                             |
| `name`          | `string`                   | —       |                                                                |
| `className`     | `string`                   | —       | Merged onto the root                                           |
| `aria-label`    | `string`                   | —       | Forwarded to the input (for label-less usage)                  |
| `autoFocus`     | `boolean`                  | —       | Forwarded to the input                                         |
| `id`            | `string`                   | —       | Forwarded to `NumberField.Root`                                |

**onChange NaN-for-empty contract (kept):** base-ui reports `null` for a cleared input; this component maps it to `NaN` (`onChange?.(next ?? NaN)`) so consumers keep the legacy "empty is NaN" contract. Symmetrically, when controlled without a `defaultValue`, an incoming `value` of `null`/`NaN` is passed to base-ui as `null` (empty). When `defaultValue` is defined, `value` is passed through untouched.

## 4 Variants

No component-specific tv recipe and **no size axis**. The field box pins the `md` rung per [conventions](conventions.md) ruling 2, 2026-08-21: `h-(--control-h-md)` plus `controlInsetMdClass` (the md inset/type pair) on the input, and composes shared `focusRing({ target: "within" })`. The group's chrome is `fieldBoxChromeClass` (§8.8). A module-private `stepperButton` class string is shared by Increment/Decrement. Nothing exported from the public entry.

**Density mapping.** Single-height field box → `md` rung. Dense computed height matches the ref's `h-9`; comfortable is the signed `ui.css` column. No `dense:` / `comfortable:` variants.

## 5 Consumed tokens

`card` (field-box surface — canonical replacement for the ref's `bg-white`), `input` (border), `ring` + `background` (shared focus-within recipe), `error` (aria-invalid border + `error/20` ring — ref's `destructive`), `muted` (disabled/read-only fill, stepper hover/disabled fill), `muted-foreground` (denomination), `background` + `foreground` (stepper buttons). Radius `rounded-md`.

## 6 Data attributes

- **Emitted:** `data-slot="field"`, `data-slot="field-label"`, `data-slot="field-description"`, `data-slot="field-error"`; `data-focus-ring-control` on `NumberField.Input`; base-ui NumberField parts emit their own state attributes (`data-disabled`, `data-readonly`, `data-required`, `data-scrubbing` on Root/Group/Input per base-ui).
- **Consumed:** Group styles against its own `aria-invalid` (`aria-invalid:` variants); base-ui Field `data-invalid`/`data-disabled` available on the root.
- `aria-invalid` on the Group uses the `isInvalid || undefined` idiom — never `"false"` (conventions §API).

## 7 Accessibility

- Input is a `spinbutton`-pattern text input managed by base-ui: ArrowUp/ArrowDown step, PageUp/PageDown large-step, Home/End clamp to min/max; typed input is parsed and displayed per `formatOptions` plus the provider locale, never `navigator.language` or a component prop.
- Increment/Decrement are buttons with base-ui-provided labels; the caret icons are `aria-hidden`.
- Field wiring (label/description/error ids) via base-ui Field; `Field.Error` has `role="alert"`.
- `aria-label` prop supports label-less fields; when `label` is set, Field.Label is the accessible name.
- `denomination` is visual-only (not part of the accessible name/value); consumers needing it announced should include the unit in `label` or `aria-label`.

## 8 Divergence from reference

1. **Icon swaps:** lucide `ChevronUp`/`ChevronDown` become named Phosphor `CaretUp`/`CaretDown` imports; the reference loader/check icons become named Phosphor `SpinnerGap`/`Check` imports.
2. **Token renames:** `destructive` → `error`; `bg-white` → `bg-card`; ref's `dark:bg-input/30` / `inverted:bg-input/30` dropped — dark axis lives in tokens.
3. **Kept as-is (documented, not divergence):** closed prop list; NaN-for-empty `onChange` contract; `aria-invalid` `x || undefined` idiom; no size axis; pending/success icons in the label row forcing the row to exist without a label (same caveat as TextField).
4. **Focus unified:** the Group's legacy local focus-within border/ring becomes shared `focusRing({ target: "within" })`, read from the module-scope `withinFocusRingClass`/`withinFocusRingControlClass` constants rather than resolved per render (2026-09-03, spec 08 finding S18).
5. **Locale is provider-only:** no public `locale` prop is added; `useElmeraGroupUi().locale` is passed to `NumberField.Root`, matching Meter and ADR 0006's single-source rule.
6. **Density retokenization:** the fixed `h-9` box pins the `md` rung without gaining a `size` axis.
7. **Pending/success crossfade adopted (2026-09-03):** the two glyphs were stacked side by side here while TextField crossfaded them, so the same two booleans produced two different label rows. Both composites now render the shared package-private field frame, whose indicator keeps both faces mounted in a `relative size-3.5` box and crossfades them with `iconCrossfadeTransition`/`iconCrossfadeShown`/`iconCrossfadeHidden`; success wins. This is the one deliberate rendered-output change of that migration — the §2 label row and the `isSuccess` row in §3 are amended with it, and §9 pins it.
8. **Group chrome is the shared field-box chrome.** _(2026-09-04.)_ The group was restating Input's elevation, radius, border, fill, and transition by hand, and had already dropped `border-color` from the transition list. It now composes `fieldBoxChromeClass`; the one rendered change is that an invalid border transitions its colour like every other field box. `internal-stack.test.ts` asserts the group's computed chrome beside the two recipe tiers.

## 9 Test requirements

- Role/label queries: input by `getByRole("textbox", { name })` (base-ui renders a text input), steppers by `getByRole("button")`.
- Keyboard per §7: ArrowUp/ArrowDown change value by `step`; Home/End clamp to `minValue`/`maxValue`; typing then blur commits the parsed value.
- `onChange` fires with numbers; clearing the input fires `onChange(NaN)`.
- Clamping: values outside `minValue`/`maxValue` clamp on commit; steppers disable at bounds.
- `formatOptions` formatting round-trips (e.g. currency/percent display, numeric onChange). Locale-matrix coverage renders the same decimal under all four provider locales and compares the visible value to `Intl.NumberFormat(providerLocale, formatOptions)` (including `nb-NO` decimal comma/group spacing versus `en-US` decimal point/comma grouping); set the browser locale to a conflicting value in at least one case to prove the primitive follows context rather than `navigator.language`.
- Pending/success: both glyphs are in the DOM whenever either flag is set, exactly one is opaque, and `isSuccess` beats `isPending` (§8.7); the row renders without a label.
- `isDisabled`/`isReadOnly`: steppers and input inert vs. read-only-focusable; `isInvalid` sets `aria-invalid` on the group and shows the alert when `errorMessage` present.
- Form integration: `name` submits the numeric value via the hidden input base-ui manages.
- Dual-density: at document `dense` and `comfortable`, the field-box height matches the signed `md` rung; nested `data-density` does not rescope.

## 10 Demo requirements

Plain `.tsx` demos: `number-field-basic` (label, step, min/max), `number-field-denomination` (unit suffix), `number-field-format` (`formatOptions` currency/percent), `number-field-error` (isInvalid + errorMessage), `number-field-states` (disabled, read-only, pending/success), `number-field-uncontrolled` (defaultValue + NaN-on-clear logging).
