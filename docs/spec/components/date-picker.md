# DatePicker

## 1 Header

- **Canonical name:** `DatePicker` (secondary exports: `DatePickerPresetGroup`, `DatePickerPresetItem`)
- **Export path:** `@elmeragroup/ui/react-aria/date-picker` — `react-aria/` quarantine prefix (path-policy ruling): interim exports never occupy bare paths.
- **RSC:** client
- **Tier:** **react-aria interim** — labeled composite over `react-aria-components` `DatePicker`. **Migration roadmap:** replaced by a base-ui composition (Popover + successor Calendar + DateField); bare `@elmeragroup/ui/date-picker` is minted for the successor and this module, its RAC internals, `tailwindcss-react-aria-components`, and `@internationalized/date` are deleted together.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/date-picker.tsx` + `styles/date-picker.ts`.

## 2 Anatomy

```
AriaDatePicker                        (RAC DatePicker; base slot)
├─ Label                              — when `label` (private field internals)
├─ FieldGroup (group slot, min-w-[180px])
│  ├─ DateInput (input slot)          — public, from react-aria/date-field
│  └─ Button variant="ghost" size="icon-sm" (private RAC Button)
│     └─ CalendarBlank (named icon import, icon slot, aria-hidden; see §8)
├─ Description                        — when `description`
├─ FieldError                         — errorMessage (renders only when invalid)
└─ Popover placement="bottom right"   (private RAC popover internal)
   └─ Dialog closeButton={false}      (private styled dialog internal; dialog slot p-0)
      └─ div (flex gap-x-3 divide-x pr-3 pb-3 — only when presetGroup)
         ├─ {presetGroup}             — consumer-provided DatePickerPresetGroup
         └─ Calendar (calendar slot: border-none)  — public, focusedValue-synced
```

**Private internals this composes (all stay private, die with the tier):** the styled `Dialog` (RAC Dialog + heading/close chrome), `Modal`, the RAC `Button` (exists solely because RAC slots — here the picker trigger, in Calendar `previous`/`next` — can't be filled by the base-ui Button), and the RAC `Popover` (dropped from public exports; zero consumers).

**Normative private RAC support stack:** `internal/button.tsx` wraps RAC Button while borrowing `buttonVariants` by a relative package-private import; `internal/field.tsx` owns Label/Input/Description/FieldError/FieldGroup and private `fieldGroupVariants`; `internal/checkbox.ts` owns private `checkboxVariants` used by GridList; `internal/dialog.tsx`, `modal.tsx`, and `popover.tsx` own overlay chrome and containment. `fieldGroupVariants` composes shared `focusRing({ target: "state", isFocusVisible })`, never its own outline/ring. Popover resolves portal target explicit `container` → nearest ThemeScope → RAC default, then forwards RAC's portal-container prop. Modal and Popover share the package-private `OVERLAY_CONTAINER_ATTR` constant solely for nested outside-interaction detection. None of these modules or recipes appears in `package.json#exports`.

**Focused-month sync (kept faithfully):** local `focusedValue` state initialized from `props.value` via `toCalendarDate` (falling back to `today(getLocalTimeZone())` when null/undefined) and re-synced by `useEffect` on every `props.value` change; passed to `Calendar` as `focusedValue`/`onFocusChange`. Effect: reopening the popover always lands on the selected (or current) month, even after the user paged away. The three helpers `toCalendarDate`, `today`, and `getLocalTimeZone` are imported only by this module at v1. The `@internationalized/date` dependency itself remains available to the whole private date cluster and uninstalls with that cluster, as [architecture](../architecture.md) §6 requires.

## 3 Props

### DatePicker

`DatePickerProps<T extends DateValue>` — spreads onto RAC `DatePicker` (open surface: `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `granularity`, `placeholderValue`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `isDateUnavailable`, `validate`, `name`, `isOpen`/`onOpenChange`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | — | |
| `description` | `string` | — | |
| `errorMessage` | `ReactNode \| ((v: ValidationResult) => ReactNode)` | — | unified composite face; forwarded as FieldError children |
| `defaultValue` | `T \| null` | — | Widened to allow explicit `null` (kept from ref) |
| `presetGroup` | `ReactNode` | — | Rendered beside the calendar; triggers the `divide-x` two-pane layout |
| `isReadOnly` | `boolean` | `false` | Destructured to drive the `isReadOnly` tv variant (`bg-muted` group/icon) |
| `shouldForceLeadingZeros` | `boolean` | **`true`** | |
| `className` | RAC className | — | Composed onto `base` slot |
| `container` | `HTMLElement \| RefObject<HTMLElement>` | nearest `ThemeScope` | forwarded to private Popover; explicit value wins |

### DatePickerPresetGroup

`ComponentProps<RadioGroup> & { label?: string }` — a RAC `RadioGroup` (`flex flex-col gap-2 px-3`), `data-slot="date-picker-preset-group"`; `label` defaults to dictionary `datePicker.presets` and supplies `aria-label`.

### DatePickerPresetItem

`ComponentProps<Radio> & { description?: string; isCloseDialogOnDoubleClick?: boolean }` — a RAC `Radio` styled as a ghost `sm` button (`buttonVariants`; radio indicator hidden, `data-selected:bg-accent`), `data-slot="date-picker-preset-item"`. Its visible children are its accessible name; the component does not synthesize English from `value`. **Reads `DatePickerStateContext`:** on double-click it calls the consumer's `onDoubleClick`, then — when `isCloseDialogOnDoubleClick` and `context?.open` — `context.close()`.

## 4 Variants

`datePickerVariants` — slotted tv recipe in `styles/date-picker.ts`, **module-private**. Slots: `base`, `group`, `input`, `icon`, `dialog` (`p-0`, overriding the styled Dialog's padding), `calendar` (`border-none` — strips Calendar's card border inside the popover, which already provides chrome). Single axis: `isReadOnly` → `bg-muted` on `group` + `icon`. Preset items borrow the shared public `buttonVariants` (ghost/sm).

## 5 Consumed tokens

Via composed parts: `card` (FieldGroup, popover, and calendar surfaces) + `card-foreground`, `input`/`ring` (FieldGroup), `muted` (read-only fill), `primary`/`primary-foreground` (selected day, focused segment), `accent` (selected preset, pressed day), `muted-foreground` (placeholder segments, weekday header), `error` (invalid border, FieldError, invalid day), `border` (popover border, preset `divide-x`), `foreground`. Own slots add no raw palette classes.

## 6 Data attributes

- **Emitted:** `data-slot="date-picker-preset-group"`, `data-slot="date-picker-preset-item"`; RAC state attributes on root/group/segments/cells (`data-open`, `data-invalid`, `data-disabled`, `data-selected`, …).
- **Consumed — the cluster's most fragile seam:** the popover internal stamps `data-overlay-container="popover"` on its RAC Popover element; the modal internal's `shouldCloseOnInteractOutside` walks `element.closest('[data-overlay-container="popover"]')` and refuses to dismiss the modal when the interaction landed inside a popover. This keeps a DatePicker opened inside a Modal/Sheet from closing its host when the user clicks the calendar. In the ref both sides hardcode the DOM string. **Locked ruling:** the attribute name/value pair becomes a module-exported but package-private constant — `export const OVERLAY_CONTAINER_ATTR = "data-overlay-container"` (value `"popover"`) in a shared internals module that is absent from `package.json#exports` — with popover spreading `{ [OVERLAY_CONTAINER_ATTR]: "popover" }` and modal building its `closest()` selector from the same constant, so the coupling can't silently drift.

## 7 Accessibility

- RAC DatePicker composes group semantics: segments are `spinbutton`s (see date-field §7); the trigger button gets an RAC-provided accessible name ("Calendar") and `aria-expanded`; the popover contains a `dialog` wrapping the `grid` calendar.
- Keyboard: segment editing per DateField; the trigger opens the dialog and focus moves to the calendar grid; grid navigation per Calendar §7; Escape closes and returns focus to the trigger; selecting a date closes the popover.
- Preset radios form a locale-labeled `radiogroup`; each radio is named by visible content. Arrow keys move between presets, Space selects, double-click (pointer affordance only) also closes the dialog.
- `errorMessage` supports ReactNode or a `(ValidationResult) => ReactNode` function.

## 8 Divergence from reference

1. **Export path quarantine:** `./date-picker` → `react-aria/date-picker`.
2. **Icon swap:** the reference's lucide calendar mapping becomes the named **Phosphor `CalendarBlank`** import from `@elmeragroup/ui/icons` — picked over Phosphor `Calendar` because the blank glyph reads as an affordance rather than a specific date; stated here as the canonical choice for the whole cluster.
3. **`data-overlay-container` string → shared `OVERLAY_CONTAINER_ATTR` constant** (locked ruling, §6).
4. **`errorMessage` widened** to the library-wide `ReactNode | render function` face.
5. **Kept:** focused-month sync incl. today-fallback; `shouldForceLeadingZeros = true`; `defaultValue: T | null` widening; preset group/item incl. `isCloseDialogOnDoubleClick`; `Dialog closeButton={false}`; `Popover placement="bottom right"` (arrow shown — popover internal defaults `showArrow = true`).
6. **Private internals stay private:** Dialog, Modal, RAC Button, RAC Popover (dropped from public surface entirely).
7. **Interim-only regular dependencies:** `tailwindcss-react-aria-components` modifiers and `@internationalized/date` uninstall with the cluster.
8. Adds `container` and nearest-ThemeScope default; preset group copy uses the locale dictionary and preset items use visible names.
9. Inherited RAC `fieldGroupVariants` uses `bg-card` instead of `bg-background`, aligning the date field box with the input-surface convention.

## 9 Test requirements

- Role/label queries: group by label, segments by `spinbutton`, trigger by `getByRole("button")`, popover content by `getByRole("dialog")`, days by `gridcell`.
- Open/select flow: click trigger → dialog + grid visible → Enter on a day fires `onChange` and closes; Escape closes without change and restores trigger focus.
- Focused-month sync: set `value` to a past month, page forward twice, close, reopen → the value's month is shown again; with no value the current month shows.
- Presets: radios queried by `radio` role and their `aria-label`s; single click selects (dialog stays open); double-click with `isCloseDialogOnDoubleClick` closes the dialog.
- Overlay seam: DatePicker inside a Modal — clicking a calendar day must not dismiss the Modal (regression test for `OVERLAY_CONTAINER_ATTR`).
- `shouldForceLeadingZeros` default; `errorMessage` function form renders per `ValidationResult`; `isReadOnly` applies `bg-muted` state and keeps the popover closed.
- Explicit/nearest-scope portal container behavior; all four preset-group locale defaults and the `label` override.

## 10 Demo requirements

Plain `.tsx` demos: `date-picker-basic` (label/description), `date-picker-controlled` (value + onChange), `date-picker-presets` (PresetGroup with "Today"/"In a week" items, one with `isCloseDialogOnDoubleClick`), `date-picker-validation` (minValue + function errorMessage), `date-picker-states` (disabled, read-only, required), `date-picker-in-modal` (overlay-container seam showcase).
