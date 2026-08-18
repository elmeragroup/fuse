# DateField

## 1 Header

- **Canonical name:** `DateField` (secondary export: `DateInput`)
- **Export path:** `@elmeragroup/ui/react-aria/date-field` — the `react-aria/` prefix is the quarantine marker (path-policy ruling): interim exports never occupy bare paths.
- **Tier:** **react-aria interim** — labeled composite over `react-aria-components` `DateField`. **Migration roadmap:** replaced by a base-ui date field when base-ui ships one; at that point the bare path `@elmeragroup/ui/date-field` is minted for the successor and this module is deleted. New consumers should expect churn.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/date-field.tsx` + `styles/date-field.ts`, `styles/field.ts` (`fieldGroupVariants`).

## 2 Anatomy

```
AriaDateField                       (RAC DateField, flex flex-col gap-1)
├─ Label                            — when `label` (private react-aria field internals)
├─ DateInput                        (RAC DateInput styled via fieldGroupVariants + input slot)
│  └─ DateSegment (×n)              — one per locale segment (day/month/year/literal)
├─ Description                      — when `description` (RAC Text slot="description")
└─ FieldError                       — RAC FieldError; renders only when field is invalid
```

`DateInput` is **exported** (kept from the ref): DatePicker and DateRangePicker consume it, and it is the reusable segment-row surface for custom compositions. It renders segments itself — its `children` prop is omitted from the public type (`Omit<DateInputProps, "children">`).

## 3 Props

### DateField

`DateFieldProps<T extends DateValue>` — spreads onto RAC `DateField` (open prop list: `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `granularity`, `hourCycle`, `placeholderValue`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `validate`, `name`, `autoFocus`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | — | Renders internal `Label` |
| `description` | `string` | — | Renders `Description` |
| `errorMessage` | `string \| ((v: ValidationResult) => string)` | — | RAC `FieldError` face — kept faithfully for the interim tier (see §8) |
| `shouldForceLeadingZeros` | `boolean` | **`true`** | Ref flips RAC's locale-dependent default; kept |
| `className` | `string \| (renderProps) => string` | — | Composed via `composeTailwindRenderProps` |

### DateInput

`Omit<RAC DateInputProps, "children">` — `slot` (`"start"`/`"end"` inside range pickers), `className` (render-prop-composed into `fieldGroupVariants` + `input` slot class).

## 4 Variants

`dateFieldVariants` — slotted tv recipe in `styles/date-field.ts`, **module-private** (not exported from the package). Slots: `base` (column), `input` (segment row), `segment`. Variant axes on `segment` (driven by RAC render props): `isPlaceholder`, `isDisabled`, `isFocused`. No size axis. `DateInput` additionally runs `fieldGroupVariants` (shared field-box recipe: `h-9 rounded-lg border bg-background`, focus-within ring, invalid/disabled/read-only borders) with the `input` slot class as `class`.

## 5 Consumed tokens

`background` (field box), `input` + `ring` (fieldGroup borders), `foreground` (segment text), `muted-foreground` (placeholder segments — ref `text-gray-600 italic`; disabled segments — ref `text-gray-200`), `primary` + `primary-foreground` (focused segment highlight — ref `bg-primary text-white`), `error` (FieldError text + invalid border — ref `destructive`), `muted` (read-only/disabled fill via fieldGroupVariants). Radii: `rounded-lg` field box, `rounded-xs` segments. Forced-colors fallbacks (`[ButtonText]`, `[GrayText]`, `[Highlight]`, `[HighlightText]`, `[Field]`) kept as-is.

## 6 Data attributes

- **Emitted:** RAC's own state attributes on each part — `data-invalid`, `data-disabled`, `data-readonly`, `data-required` on the field root; `data-focus-within`, `data-invalid` on DateInput; `data-placeholder`, `data-focused`, `data-type` on segments. No custom `data-slot` attributes in the ref; the port adds none.
- **Consumed:** styling flows through tv render-prop variants, not `data-*` Tailwind selectors, except the plugin-provided RAC modifiers (see §8 devDependency note).

## 7 Accessibility

- RAC DateField renders a `role="group"` segment row; each editable segment is `role="spinbutton"` with `aria-valuenow/-valuetext`, literals are presentational.
- Keyboard: Left/Right move between segments; Up/Down (and typing digits) change the focused segment; Backspace clears it. Segments show `caret-transparent` — the highlight (`bg-primary`) is the focus indication.
- Label/description/error are wired by RAC (`aria-labelledby`/`aria-describedby`); `FieldError` only renders when invalid, and accepts the validation-function face for granular messages.
- `aria-label` passthrough supports label-less usage.

## 8 Divergence from reference

1. **Export path quarantine:** ref path `./date-field` → `react-aria/date-field` (locked path-policy ruling; self-documenting migration marker).
2. **Token renames:** segment `text-gray-600` → `text-muted-foreground` (placeholder), `text-gray-200` → `text-muted-foreground` (disabled), focused `text-white` → `text-primary-foreground`, `destructive` → `error` — `no-primitive-colors` lint applies to interim code too.
3. **`errorMessage: string | ((v: ValidationResult) => string)` kept** — a deliberate interim-tier exception to the conventions' unified `errorMessage: ReactNode`. It is RAC FieldError's native face; the base-ui successor adopts `ReactNode`.
4. **Kept (documented, not divergence):** `shouldForceLeadingZeros = true` default; `DateInput` public; open RAC prop spread.
5. **Interim-only devDependency:** RAC state modifiers in classes (`type-literal:` on segments, plus the cluster's `selected:`, `outside-month:`, `group-pressed:`, `selection-start:`, `invalid:selected:` etc.) come from `tailwindcss-react-aria-components`. That plugin is interim-tier surface and uninstalls with this cluster.

## 9 Test requirements

- Role/label queries only: field by `getByRole("group", { name: label })`, segments by `getAllByRole("spinbutton")`.
- Segment keyboard per §7: ArrowRight/ArrowLeft traverse segments; ArrowUp/ArrowDown increment/decrement; typing `14` fills a day segment and auto-advances; Backspace restores placeholder.
- `shouldForceLeadingZeros`: day/month render `07`, not `7`, by default.
- `onChange` fires with a `DateValue` (not an event); `minValue`/`maxValue` violations set `data-invalid` and render `errorMessage` (both string and `(v) => string` forms).
- `isDisabled`/`isReadOnly`: segments unreachable vs. focusable-but-inert; `name` submits the ISO string in a form.

## 10 Demo requirements

Plain `.tsx` demos: `date-field-basic` (label + description), `date-field-validation` (minValue + function-form errorMessage), `date-field-granularity` (date vs. hour granularity, `hourCycle`), `date-field-states` (disabled, read-only, required), `date-field-date-input` (standalone `DateInput` inside a custom composition).
