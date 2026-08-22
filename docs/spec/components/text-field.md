# TextField

## 1 Header

- **Canonical name:** `TextField`
- **Export path:** `@elmeragroup/ui/text-field` (also re-exported from `@elmeragroup/ui`); `textFieldVariants` comes from the same entry
- **RSC:** client
- **Tier:** labeled composite (single-component export; not a namespace compound)
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/text-field.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/styles/text-field.ts`; absorbed: `.ref/OrderModuleWeb/packages/ui/src/numeric-only-text-field.tsx`

## 2 Anatomy

```
Field.Root                          (base-ui Field.Root; slot `base`)
├─ label row (div, slot `labelContainer`)          — rendered when label || isPending || isSuccess
│  ├─ Field.Label (slot `label`)                   — when `label`
│  └─ pending/success indicator (div, size-3.5)    — when isPending || isSuccess
│     ├─ SpinnerGap (named import, animate-spin, crossfade) — pending face
│     └─ Check (named import, crossfade)                    — success face
├─ container (div, slot `container`)
│  ├─ relative wrapper (div)
│  │  ├─ Input (base-ui Input; Field.Control; slot `input`, + `fieldGroup` when variant set)
│  │  └─ icon slot (div, slot `iconContainer`)     — when `icon`
│  └─ Field.Description (slot `description`)       — when `description`
└─ Field.Error                                     — renders only when errorMessage is truthy
```

The pending/success indicator crossfades via the shared `iconCrossfadeTransition`/`iconCrossfadeShown`/`iconCrossfadeHidden` utilities from `styles/utils`.

## 3 Props

`TextFieldProps` = the table below `& Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "name" | "className">` — all remaining native input props (`type`, `inputMode`, `maxLength`, `autoComplete`, `aria-*`, …) spread onto the inner Input.

| Prop           | Type                      | Default | Notes                                                                                                                                                                                        |
| -------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`        | `string`                  | —       | Rendered as `Field.Label`                                                                                                                                                                    |
| `description`  | `string`                  | —       | Rendered as `Field.Description`, `text-pretty`                                                                                                                                               |
| `errorMessage` | `ReactNode`               | —       | Unified type per conventions; `Field.Error` renders only when truthy                                                                                                                         |
| `value`        | `string`                  | —       | Controlled value                                                                                                                                                                             |
| `defaultValue` | `string \| null`          | —       | `null` is coerced to `undefined` before reaching the input                                                                                                                                   |
| `onChange`     | `(value: string) => void` | —       | Value, not event                                                                                                                                                                             |
| `name`         | `string`                  | —       |                                                                                                                                                                                              |
| `placeholder`  | `string`                  | —       |                                                                                                                                                                                              |
| `hidden`       | `boolean`                 | `false` | Hides both the root (`hidden` variant axis) and the input (native `hidden`)                                                                                                                  |
| `isReadOnly`   | `boolean`                 | `false` | → input `readOnly`                                                                                                                                                                           |
| `isDisabled`   | `boolean`                 | `false` | → `Field.Root disabled` **and** input `disabled` (see §8)                                                                                                                                    |
| `isInvalid`    | `boolean`                 | `false` | → `Field.Root invalid`                                                                                                                                                                       |
| `isRequired`   | `boolean`                 | `false` | → input `required`                                                                                                                                                                           |
| `isPending`    | `boolean`                 | `false` | Shows spinner in label row (see §8)                                                                                                                                                          |
| `isSuccess`    | `boolean`                 | `false` | Shows check in label row; wins the crossfade over pending                                                                                                                                    |
| `icon`         | `ReactNode`               | —       | Trailing inline icon; activates `isIconActive` axis                                                                                                                                          |
| `filter`       | `"numeric"`               | —       | **New (absorbs NumericOnlyTextField, §8).** Drops any change whose value is not digits-only (empty allowed); auto-sets `inputMode="numeric"` unless the caller passes `inputMode` explicitly |
| `variant`      | `"card" \| "inline"`      | —       | See §4                                                                                                                                                                                       |
| `className`    | `string`                  | —       | Merged onto the root via `cn`                                                                                                                                                                |

With `filter="numeric"`, rejected keystrokes never reach `onChange` and never update uncontrolled internal state; a dev-only `console.warn` fires when a supplied `value`/`defaultValue` is not digits-only (behavior carried over from the ref).

## 4 Variants

Recipe: `textFieldVariants` (tv, slots) — **public export** (borrowed by `PhoneNumberField`).

Slots: `base`, `fieldGroup`, `input`, `labelContainer`, `label`, `container`, `description`, `iconContainer`. The ref's `textArea` slot (`min-h-16`) is dead and removed (§8).

| Axis           | Values          | Default | Effect                                                                                                                                                                                                                                     |
| -------------- | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `variant`      | `card`          | —       | `base` composes `cardVariants.slots.base` + `gap-0 px-6 py-4`; borderless full-width `fieldGroup`; `input` unstyled `text-lg`; `label`/`description` `text-muted-foreground`; `container` becomes horizontal `flex-row items-center gap-3` |
|                | `inline`        |         | `base` adds `group/inline-field`; the inner input retains shared `focusRing({ target: "self" })` and is transparent at rest, `border-input` + `bg-background` on hover, `border-error` + `bg-background` on `group-data-[invalid]`         |
| `hidden`       | `true \| false` | `false` | `base: hidden`                                                                                                                                                                                                                             |
| `isIconActive` | `true \| false` | `false` | `fieldGroup: relative`; `input: truncate overflow-hidden pr-10 whitespace-nowrap`                                                                                                                                                          |

`variant` unset renders the plain Input styling. When `variant` is set, the component applies `fieldGroup()` after `input()` on the inner input (ref comment: fieldGroup's default `w-auto` would otherwise override the input's `w-full`).

## 5 Consumed tokens

`card` (input surface + `variant="card"` shell via `cardVariants`), `input` (border), `ring` + `background` (shared focus recipe), `error` (invalid border/ring — canonical name for the ref's `destructive` classes), `muted-foreground` (description, placeholder, card label), `foreground`. Radius from `--radius`-derived `rounded-md`; no raw palette classes — the ref Input's `bg-white` becomes `bg-card` per conventions.

## 6 Data attributes

- **Emitted:** `data-slot="field"` (root), `data-slot="field-label"`, `data-slot="field-description"`, `data-slot="field-error"`, `data-slot="input"`.
- **Emitted by base-ui Field:** `data-invalid`, `data-disabled`, `data-touched`, `data-dirty`, `data-filled`, `data-focused` on root and control.
- **Consumed:** the `inline` variant styles against `group-data-[invalid]/inline-field`; `FieldLabel` dims on `group-data-[disabled=true]/field`.

## 7 Accessibility

- base-ui Field wires `id`/`for`/`aria-describedby` between label, control, description, and error automatically.
- `Field.Error` renders with `role="alert"` and `match` (visibility owned by the external validator via `isInvalid`/`errorMessage`).
- Invalid state sets `aria-invalid` on the control via base-ui; styles hook `aria-invalid:` variants.
- Keyboard: plain text input; no component-specific bindings. Disabled input is not focusable (post-bugfix, §8).
- The pending/success indicator is decorative (crossfading icons); status must also be conveyed by the consumer where it matters.

## 8 Divergence from reference

1. **Absorbs `NumericOnlyTextField`** (OrderModuleWeb) via `filter="numeric"`. The external wrapper is retired. Migration: `<NumericOnlyTextField …/>` → `<TextField filter="numeric" …/>`; the digits-only guard and dev warnings are preserved; `inputMode="numeric"` is now auto-applied (the wrapper never set it).
2. **Bugfix: `isDisabled` forwards to the input.** The ref only set `disabled` on `Field.Root`; the spec requires the inner input to receive `disabled` as well so the control is natively disabled regardless of Field-context propagation.
3. **`textArea` slot removed** from `textFieldVariants` — never referenced by any component in the ref.
4. **Pending/success placement kept but flagged:** `isPending`/`isSuccess` render in the label row and force that row to exist even when `label` is absent (layout shifts by one row). Kept for ref parity; candidates for a later in-input placement.
5. **Icon swaps:** the reference loader/check icons become named Phosphor `SpinnerGap` (with `animate-spin`) / `Check` imports.
6. **Token renames:** `destructive` → `error`, `bg-white` → `bg-card`, `dark:`/`inverted:` input-surface variants dropped in favor of token-level dark axis.

## 9 Test requirements

- Renders label/description/error, all queried by role/accessible name (`getByRole("textbox", { name })`, `getByRole("alert")`).
- `onChange` receives the string value (not the event) on typing.
- `isDisabled`: input is `disabled` and unfocusable; `isReadOnly`: value can't be typed but input is focusable.
- `isInvalid` + `errorMessage`: alert visible, `aria-invalid` set on the input; no alert when `errorMessage` absent.
- `filter="numeric"`: typing letters produces no `onChange` and no value change; digits pass; paste of mixed content is rejected wholesale; `inputMode` is `numeric` unless overridden.
- `isPending`/`isSuccess` render the indicator row without a label; success wins over pending.
- Keyboard per §7: Tab order label→input; disabled input skipped.

## 10 Demo requirements

Plain `.tsx` demos, one per scenario: `text-field-basic` (label + description + placeholder), `text-field-error` (isInvalid + errorMessage), `text-field-states` (disabled, read-only, required), `text-field-pending-success` (crossfade), `text-field-icon` (trailing icon), `text-field-numeric` (filter="numeric"), `text-field-card` (variant="card"), `text-field-inline` (variant="inline").
