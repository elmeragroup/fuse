# DatePicker

## 1 Header

- **Canonical name:** `DatePicker` (secondary exports: `DatePickerPresetGroup`, `DatePickerPresetItem`)
- **Export path:** `@elmeragroup/ui/react-aria/date-picker` — `react-aria/` quarantine prefix (path-policy ruling): interim exports never occupy bare paths.
- **Tier:** **react-aria interim** — labeled composite over `react-aria-components` `DatePicker`. **Migration roadmap:** replaced by a base-ui composition (Popover + successor Calendar + DateField); bare `@elmeragroup/ui/date-picker` is minted for the successor and this module, its RAC internals, `tailwindcss-react-aria-components`, and `@internationalized/date` are deleted together.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/date-picker.tsx` + `styles/date-picker.ts`.

## 2 Anatomy

```
AriaDatePicker                        (RAC DatePicker; base slot)
├─ Label                              — when `label` (private field internals)
├─ FieldGroup (group slot, min-w-[180px])
│  ├─ DateInput (input slot)          — public, from react-aria/date-field
│  └─ Button variant="ghost" size="icon-sm" (private RAC Button)
│     └─ Icon.Calendar (icon slot, aria-hidden)   — Phosphor CalendarBlank, see §8
├─ Description                        — when `description`
├─ FieldError                         — errorMessage (renders only when invalid)
└─ Popover placement="bottom right"   (private RAC popover internal)
   └─ Dialog closeButton={false}      (private styled dialog internal; dialog slot p-0)
      └─ div (flex gap-x-3 divide-x pr-3 pb-3 — only when presetGroup)
         ├─ {presetGroup}             — consumer-provided DatePickerPresetGroup
         └─ Calendar (calendar slot: border-none)  — public, focusedValue-synced
```

**Private internals this composes (all stay private, die with the tier):** the styled `Dialog` (RAC Dialog + heading/close chrome), `Modal`, the RAC `Button` (exists solely because RAC slots — here the picker trigger, in Calendar `previous`/`next` — can't be filled by the base-ui Button), and the RAC `Popover` (dropped from public exports; zero consumers).

**Focused-month sync (kept faithfully):** local `focusedValue` state initialized from `props.value` via `toCalendarDate` (falling back to `today(getLocalTimeZone())` when null/undefined) and re-synced by `useEffect` on every `props.value` change; passed to `Calendar` as `focusedValue`/`onFocusChange`. Effect: reopening the popover always lands on the selected (or current) month, even after the user paged away. `@internationalized/date` (`toCalendarDate`, `today`, `getLocalTimeZone`) has **this module as its only consumer** — the dependency uninstalls with the cluster.

## 3 Props

### DatePicker

`DatePickerProps<T extends DateValue>` — spreads onto RAC `DatePicker` (open surface: `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `granularity`, `placeholderValue`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `isDateUnavailable`, `validate`, `name`, `isOpen`/`onOpenChange`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | — | |
| `description` | `string` | — | |
| `errorMessage` | `string \| ((v: ValidationResult) => string)` | — | RAC FieldError face, kept faithfully (interim exception to `ReactNode` convention) |
| `defaultValue` | `T \| null` | — | Widened to allow explicit `null` (kept from ref) |
| `presetGroup` | `ReactNode` | — | Rendered beside the calendar; triggers the `divide-x` two-pane layout |
| `isReadOnly` | `boolean` | `false` | Destructured to drive the `isReadOnly` tv variant (`bg-muted` group/icon) |
| `shouldForceLeadingZeros` | `boolean` | **`true`** | |
| `className` | RAC className | — | Composed onto `base` slot |

### DatePickerPresetGroup

`ComponentProps<RadioGroup> & { label?: string }` — a RAC `RadioGroup` (`flex flex-col gap-2 px-3`), `data-slot="date-picker-preset-group"`, `aria-label` defaults to `"Date picker preset options"` (`props.label ?? …`).

### DatePickerPresetItem

`ComponentProps<Radio> & { description?: string; isCloseDialogOnDoubleClick?: boolean }` — a RAC `Radio` styled as a ghost `sm` button (`buttonVariants`; radio indicator hidden, `data-selected:bg-accent`), `data-slot="date-picker-preset-item"`, `aria-label` = `` `Date picker preset option: ${value}` ``. **Reads `DatePickerStateContext`:** on double-click it calls the consumer's `onDoubleClick`, then — when `isCloseDialogOnDoubleClick` and `context?.open` — `context.close()`. This is the documented "double-click a preset to pick and dismiss" affordance.

## 4 Variants

`datePickerVariants` — slotted tv recipe in `styles/date-picker.ts`, **module-private**. Slots: `base`, `group`, `input`, `icon`, `dialog` (`p-0`, overriding the styled Dialog's padding), `calendar` (`border-none` — strips Calendar's card border inside the popover, which already provides chrome). Single axis: `isReadOnly` → `bg-muted` on `group` + `icon`. Preset items borrow the shared public `buttonVariants` (ghost/sm).

## 5 Consumed tokens

Via composed parts: `background`/`input`/`ring` (FieldGroup), `muted` (read-only fill), `card`/`card-foreground` (popover + calendar surfaces), `primary`/`primary-foreground` (selected day, focused segment), `accent` (selected preset, pressed day), `muted-foreground` (placeholder segments, weekday header), `error` (invalid border, FieldError, invalid day), `border` (popover border, preset `divide-x`), `foreground`. Own slots add no raw palette classes.

## 6 Data attributes

- **Emitted:** `data-slot="date-picker-preset-group"`, `data-slot="date-picker-preset-item"`; RAC state attributes on root/group/segments/cells (`data-open`, `data-invalid`, `data-disabled`, `data-selected`, …).
- **Consumed — the cluster's most fragile seam:** the popover internal stamps `data-overlay-container="popover"` on its RAC Popover element; the modal internal's `shouldCloseOnInteractOutside` walks `element.closest('[data-overlay-container="popover"]')` and refuses to dismiss the modal when the interaction landed inside a popover. This keeps a DatePicker opened inside a Modal/Sheet from closing its host when the user clicks the calendar. In the ref both sides hardcode the DOM string. **Locked ruling:** the attribute name/value pair becomes a shared exported constant — `export const OVERLAY_CONTAINER_ATTR = "data-overlay-container"` (value `"popover"`) in a shared internals module — with popover spreading `{ [OVERLAY_CONTAINER_ATTR]: "popover" }` and modal building its `closest()` selector from the same constant, so the coupling can't silently drift.

## 7 Accessibility

- RAC DatePicker composes group semantics: segments are `spinbutton`s (see date-field §7); the trigger button gets an RAC-provided accessible name ("Calendar") and `aria-expanded`; the popover contains a `dialog` wrapping the `grid` calendar.
- Keyboard: segment editing per DateField; the trigger opens the dialog and focus moves to the calendar grid; grid navigation per Calendar §7; Escape closes and returns focus to the trigger; selecting a date closes the popover.
- Preset radios form a labeled `radiogroup`; each radio has an explicit `aria-label` including its value; arrow keys move between presets, Space selects, double-click (pointer affordance only — no keyboard equivalent, documented limitation) also closes the dialog.
- `errorMessage` supports the `(v: ValidationResult) => string` face for granular messages.

## 8 Divergence from reference

1. **Export path quarantine:** `./date-picker` → `react-aria/date-picker`.
2. **Icon swap:** `Icon.Calendar` (lucide via the ref's icon map) → **Phosphor `CalendarBlank`** from `@elmeragroup/ui/icons` — picked over Phosphor `Calendar` because the blank glyph reads as an affordance rather than a specific date; stated here as the canonical choice for the whole cluster.
3. **`data-overlay-container` string → shared `OVERLAY_CONTAINER_ATTR` constant** (locked ruling, §6).
4. **`errorMessage` string/function face kept** — interim exception to conventions' `errorMessage: ReactNode`.
5. **Kept:** focused-month sync incl. today-fallback; `shouldForceLeadingZeros = true`; `defaultValue: T | null` widening; preset group/item incl. `isCloseDialogOnDoubleClick`; `Dialog closeButton={false}`; `Popover placement="bottom right"` (arrow shown — popover internal defaults `showArrow = true`).
6. **Private internals stay private:** Dialog, Modal, RAC Button, RAC Popover (dropped from public surface entirely).
7. **Interim-only devDependency:** `tailwindcss-react-aria-components` modifiers; `@internationalized/date` uninstalls with the cluster (sole consumer).

## 9 Test requirements

- Role/label queries: group by label, segments by `spinbutton`, trigger by `getByRole("button")`, popover content by `getByRole("dialog")`, days by `gridcell`.
- Open/select flow: click trigger → dialog + grid visible → Enter on a day fires `onChange` and closes; Escape closes without change and restores trigger focus.
- Focused-month sync: set `value` to a past month, page forward twice, close, reopen → the value's month is shown again; with no value the current month shows.
- Presets: radios queried by `radio` role and their `aria-label`s; single click selects (dialog stays open); double-click with `isCloseDialogOnDoubleClick` closes the dialog.
- Overlay seam: DatePicker inside a Modal — clicking a calendar day must not dismiss the Modal (regression test for `OVERLAY_CONTAINER_ATTR`).
- `shouldForceLeadingZeros` default; `errorMessage` function form renders per `ValidationResult`; `isReadOnly` applies `bg-muted` state and keeps the popover closed.

## 10 Demo requirements

Plain `.tsx` demos: `date-picker-basic` (label/description), `date-picker-controlled` (value + onChange), `date-picker-presets` (PresetGroup with "Today"/"In a week" items, one with `isCloseDialogOnDoubleClick`), `date-picker-validation` (minValue + function errorMessage), `date-picker-states` (disabled, read-only, required), `date-picker-in-modal` (overlay-container seam showcase).
