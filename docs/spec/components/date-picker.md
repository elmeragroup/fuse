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
├─ FieldGroup (group slot, min-w-[180px]; isReadOnly — the only read-only fill, §8.12)
│  ├─ DateInput (input slot)          — public, from react-aria/date-field
│  └─ Button variant="ghost" size="icon-sm" (private RAC Button)
│     └─ CalendarBlank (named icon import, icon slot, aria-hidden; see §8)
├─ Description                        — when `description`
├─ FieldError                         — errorMessage (renders only when invalid)
└─ Popover placement="bottom right"   (private RAC popover internal)
   └─ Dialog closeButton={false}      (private styled dialog internal; dialog slot p-0; no
                                        `title`, so no heading row — RAC's context name wins, §7)
      └─ div (pane slot; hasPresets=true only when presetGroup is renderable)
         ├─ {presetGroup}             — consumer-provided DatePickerPresetGroup
         └─ Calendar (calendar slot: border-none)  — public, month-synced by a
                                        module-private wrapper (see below)
```

**Private internals this composes (all stay private, die with the tier):** `PickerShell` (the chrome below — label, field box, trigger, help text, popover and dialog — shared with DateRangePicker, §8.12), the styled `Dialog` (RAC Dialog + heading/close chrome), the RAC `Button` (exists solely because RAC slots — here the picker trigger, in Calendar `previous`/`next` — can't be filled by the base-ui Button), and the RAC `Popover` (dropped from public exports; zero consumers).

**Normative private RAC support stack:** `internal/button.tsx` wraps RAC Button while borrowing `buttonVariants` by a relative package-private import; `internal/field.tsx` owns Label/Input/Description/FieldError/FieldGroup and private `fieldGroupVariants`; `internal/checkbox.ts` owns private `checkboxVariants` used by GridList; `internal/picker-shell.tsx` owns the chrome both pickers wear; `internal/dialog.tsx` and `popover.tsx` own overlay chrome. `fieldGroupVariants` is a single-height field box pinning the `md` rung (`h-(--control-h-md)`, not literal `h-9`) per [conventions](conventions.md) ruling 2, 2026-08-21, and composes shared `focusRing({ target: "state", isFocusVisible })`, never its own outline/ring; its surface chrome — elevation, radius, border, fill, transition — is the `fieldBoxChromeClass` constant the base-ui `fieldBox` also composes, so a DateField box matches an Input box in the same form ([date-field](date-field.md) §8.11, 2026-09-03). Popover resolves the portal target explicit `container` → nearest ThemeScope → RAC default through the shared `useResolvedPortalContainer`, then forwards RAC's portal-container prop. None of these modules or recipes appears in `package.json#exports`.

**Focused-month sync (kept; mechanism corrected — §8.13):** the popover's `Calendar` is wrapped by a module-private inner component rendered inside the RAC `DatePicker`, which reads the picker's own state from `DatePickerStateContext`. Its local `focusedValue` state is initialized from that state's committed `value` via `toCalendarDate` (falling back to `today(getLocalTimeZone())` when null/undefined) and re-synced by `useEffect` on every value change; it is passed to `Calendar` as `focusedValue`/`onFocusChange`. Reading the picker state rather than `props.value` is what makes the sync hold for **both** modes — `state.value` is the committed value whether the caller controls it or only seeded a `defaultValue`. Because the popover unmounts its content on close, the inner component mounts once per open, so its state initializer _is_ the per-open resync; the effect covers a value that changes while the dialog stays open (a preset pane lives inside the popover). Effect: reopening the popover always lands on the selected (or current) month, even after the user paged away. The three helpers `toCalendarDate`, `today`, and `getLocalTimeZone` are imported only by this module at v1. The `@internationalized/date` dependency itself remains available to the whole private date cluster and uninstalls with that cluster, as [architecture](../architecture.md) §6 requires.

## 3 Props

### DatePicker

`DatePickerProps<T extends DateValue>` — spreads onto RAC `DatePicker` (open surface: `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `granularity`, `placeholderValue`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `isDateUnavailable`, `validate`, `name`, `isOpen`/`onOpenChange`, …).

| Prop                      | Type                                                | Default              | Notes                                                                                                             |
| ------------------------- | --------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `label`                   | `string`                                            | —                    |                                                                                                                   |
| `description`             | `string`                                            | —                    |                                                                                                                   |
| `errorMessage`            | `ReactNode \| ((v: ValidationResult) => ReactNode)` | —                    | unified composite face; forwarded as FieldError children                                                          |
| `defaultValue`            | `T \| null`                                         | —                    | Widened to allow explicit `null` (kept from ref)                                                                  |
| `presetGroup`             | `ReactNode`                                         | —                    | Rendered beside the calendar; a renderable node (not `false`/`null`/`""`) triggers the `divide-x` two-pane layout |
| `isReadOnly`              | `boolean`                                           | `false`              | Destructured to drive the `isReadOnly` tv variant (`bg-muted` group/icon)                                         |
| `shouldForceLeadingZeros` | `boolean`                                           | **`true`**           |                                                                                                                   |
| `className`               | RAC className                                       | —                    | Composed onto `base` slot                                                                                         |
| `container`               | `HTMLElement \| RefObject<HTMLElement \| null>`     | nearest `ThemeScope` | forwarded to private Popover; explicit value wins                                                                 |

### DatePickerPresetGroup

`ComponentProps<RadioGroup> & { label?: string }` — a RAC `RadioGroup` (`flex flex-col gap-2 px-3`), `data-slot="date-picker-preset-group"`; `label` defaults to dictionary `datePicker.presets` and supplies `aria-label`.

### DatePickerPresetItem

`ComponentProps<Radio> & { description?: string; isCloseDialogOnDoubleClick?: boolean }` — a RAC `Radio` styled as a ghost `sm` button (`buttonVariants`; radio indicator hidden, `data-selected:bg-accent`), `data-slot="date-picker-preset-item"`. Its visible children are its accessible name; the component does not synthesize English from `value`. **Reads `DatePickerStateContext`:** on double-click it calls the consumer's `onDoubleClick`, then — when `isCloseDialogOnDoubleClick` and the picker is open (`state.isOpen`; `open` on the overlay state is a method, not a flag) — `state.close()`.

## 4 Variants

`pickerVariants` — slotted tv recipe in `styles/picker.ts`, **module-private**, shared with DateRangePicker (§8.12, 2026-09-03; it replaced `datePickerVariants` in `styles/date-picker.ts` and its byte-identical twin `dateRangePickerVariants`). Slots: `base`, `group`, `input` (`px-(--control-px-md)` plus the control type pair, no `py-*`), `separator` (the range en-dash; empty here), `icon`, `dialog` (`p-0`, overriding the styled Dialog's padding), `calendar` (`border-none` — strips Calendar's card border inside the popover, which already provides chrome), `pane` (the row inside the dialog holding the preset pane and the calendar; empty unless there are presets). Two axes: `range` → the range picker's geometry (`false` here: `min-w-[180px]` on `group`, `flex min-w-[150px] flex-1` on `input`, `border-none` on `calendar`); `hasPresets` → the divided two-pane row on `pane` (`flex gap-x-3 divide-x pr-3 pb-3`), empty when false. There is **no** `isReadOnly` axis: the fill is `fieldGroupVariants`' own, painted once by the FieldGroup (§8.12). Preset items borrow the shared public `buttonVariants` (ghost/sm).

## 5 Consumed tokens

Via composed parts: `card` (FieldGroup, popover, and calendar surfaces) + `card-foreground`, `input`/`ring` (FieldGroup), `muted` (read-only fill), `primary`/`primary-foreground` (selected day, focused segment), `accent` (selected preset, pressed day), `muted-foreground` (placeholder segments, weekday header), `error` (invalid border, FieldError, invalid day), `border` (popover border, preset `divide-x`), `foreground`. Own slots add no raw palette classes.

## 6 Data attributes

- **Emitted:** `data-slot="date-picker-preset-group"`, `data-slot="date-picker-preset-item"`; RAC state attributes on root/group/segments/cells (`data-open`, `data-invalid`, `data-disabled`, `data-selected`, …).
- **Consumed:** nothing. _(Amended 2026-09-03, §8.12 — this paragraph previously specified the `data-overlay-container` seam.)_ The picker used to stamp `data-overlay-container="popover"` on its RAC Popover element so the private RAC `Modal`'s `shouldCloseOnInteractOutside` would refuse to dismiss its host when the interaction landed inside the calendar. That modal never shipped a runtime consumer — the only host a picker is ever placed in is the public base-ui `Dialog`, which tracks nesting through the React tree and needs no attribute — so the modal, the stamp and the `OVERLAY_CONTAINER_ATTR` constant were all deleted together. The regression the seam guarded is still covered: the browser suite opens a picker inside the public `Dialog`, pages the grid and commits a day, and asserts the host never fires `onOpenChange`.

## 7 Accessibility

- RAC DatePicker composes group semantics: segments are `spinbutton`s (see date-field §7); the trigger button gets an RAC-provided accessible name ("Calendar") and `aria-expanded`; the popover contains a `dialog` wrapping the `grid` calendar.
- Keyboard: segment editing per DateField; the trigger opens the dialog and focus moves to the calendar grid; grid navigation per Calendar §7; Escape closes and returns focus to the trigger; selecting a date closes the popover.
- Preset radios form a locale-labeled `radiogroup`; each radio is named by visible content. Arrow keys move between presets, Space selects, double-click (pointer affordance only) also closes the dialog.
- `errorMessage` supports ReactNode or a `(ValidationResult) => ReactNode` function.

## 8 Divergence from reference

1. **Export path quarantine:** `./date-picker` → `react-aria/date-picker`.
2. **Icon swap:** the reference's lucide calendar mapping becomes the named **Phosphor `CalendarBlank`** import from `@elmeragroup/ui/icons` — picked over Phosphor `Calendar` because the blank glyph reads as an affordance rather than a specific date; stated here as the canonical choice for the whole cluster.
3. **No overlay-container attribute at all** _(amended 2026-09-03, see 12)_ — the ref hardcoded a `data-overlay-container` DOM string on both sides of a modal/popover seam; this port first replaced it with a shared constant and has now deleted the seam with the modal that needed it.
4. **`errorMessage` widened** to the library-wide `ReactNode | render function` face.
5. **Kept:** focused-month sync incl. today-fallback (with the mechanism corrected — see 13); `shouldForceLeadingZeros = true`; `defaultValue: T | null` widening; preset group/item incl. `isCloseDialogOnDoubleClick`; `Dialog closeButton={false}`; `Popover placement="bottom right"` (arrow shown — popover internal defaults `showArrow = true`).
6. **Private internals stay private:** PickerShell, Dialog, RAC Button, RAC Popover (dropped from public surface entirely).
7. **Interim-only regular dependencies:** `tailwindcss-react-aria-components` modifiers and `@internationalized/date` uninstall with the cluster.
8. Adds `container` and nearest-ThemeScope default; preset group copy uses the locale dictionary and preset items use visible names.
9. Inherited RAC `fieldGroupVariants` uses `bg-card` instead of `bg-background`, aligning the date field box with the input-surface convention.
10. **Density retokenization:** `fieldGroupVariants` pins `--control-h-md` instead of literal `h-9` (gates the RAC private stack). The `input` slot reads `--control-px-md` and the control type pair; `py-*` is omitted because height is pinned. _(Amended 2026-09-02.)_
11. **One picker recipe and one picker shell; the read-only fill is painted once; the dead modal stack is deleted.** _(Amended 2026-09-03; spec 08 "Overlay and field shared spine", user stories 5 and 10.)_ Four changes land together because they are one consolidation:
    - `datePickerVariants` and `dateRangePickerVariants` — shape-matched by ruling and then maintained apart, with byte-identical `base`, `icon`, `dialog` and `isReadOnly` arms — become one `pickerVariants` in `styles/picker.ts` with a `range` axis. Every difference between the two was a consequence of one fact: whether the field box holds one segment row or two.
    - `internal/picker-shell.tsx` holds the label / field box / trigger / help text / popover / dialog assembly both pickers rendered identically, including the single `require-icon-button-label` disable that was duplicated at both call sites.
    - The read-only fill was painted by the picker recipe twice — `bg-muted` on its `group` slot and again on its `icon` slot — while `fieldGroupVariants` has carried an `isReadOnly` axis all along and DateField already routed the state through it. `PickerShell` now hands `isReadOnly` to the FieldGroup and nothing else paints it. **This is the one rendered difference:** the trigger glyph loses its `bg-muted`, which never belonged on an `<svg>`; the field box keeps exactly the fill it had. RAC's `Group` also now stamps its own `data-readonly` when the picker is read-only, which §6 already covers as a RAC state attribute.
    - `internal/modal.tsx`, `internal/overlay-container.ts`, `DialogOverlay`, `DialogFooter`, the internal dialog's `bare` variant and the RAC `PopoverTrigger` re-export are deleted. No shipping module imported any of them; only the internal-stack tests did.

12. **Focused-month sync reads the picker state, not `props.value`:** the month is derived from the committed value on RAC's `DatePickerStateContext` (see §2), initialized on each open and re-synced on every value change, keeping the today-fallback — so an uncontrolled `defaultValue` picker also opens on the selected month. The reference's `props.value`-only sync left uncontrolled pickers on today's month with the selection off-screen.

## 9 Test requirements

- Role/label queries: group by label, segments by `spinbutton`, trigger by `getByRole("button")`, popover content by `getByRole("dialog")`, days by `gridcell`.
- Open/select flow: click trigger → dialog + grid visible → Enter on a day fires `onChange` and closes; Escape closes without change and restores trigger focus.
- Focused-month sync: for a controlled `value` **and** for an uncontrolled `defaultValue`, set a past month, page forward twice, close, reopen → the value's month is shown again; committing a day in an uncontrolled picker then reopening shows the new value's month; a value that changes while the dialog stays open (a preset) moves the grid with it; with no value the current month shows.
- Presets: radios queried by `radio` role and their `aria-label`s; single click selects (dialog stays open); double-click with `isCloseDialogOnDoubleClick` closes the dialog.
- Overlay nesting: DatePicker inside the public base-ui `Dialog` — paging the grid and committing a day must not fire the host's `onOpenChange` and must leave the host visible _(amended 2026-09-03, §8.12: this replaces the deleted Modal/`OVERLAY_CONTAINER_ATTR` seam test)_.
- `shouldForceLeadingZeros` default; `errorMessage` function form renders per `ValidationResult`; `isReadOnly` applies the FieldGroup's `bg-muted` fill (and no longer tints the trigger glyph, §8.12) and keeps the popover closed.
- Explicit/nearest-scope portal container behavior; all four preset-group locale defaults and the `label` override.
- Dual-density: FieldGroup height and DateInput inline padding/type match the signed `md` rung at `dense` and `comfortable`; nested `data-density` does not rescope.

## 10 Demo requirements

Plain `.tsx` demos: `date-picker-basic` (label/description), `date-picker-controlled` (value + onChange), `date-picker-presets` (PresetGroup with "Today"/"In a week" items, one with `isCloseDialogOnDoubleClick`), `date-picker-validation` (minValue + function errorMessage), `date-picker-states` (disabled, read-only, required), `date-picker-in-modal` (picker hosted in the public base-ui Dialog).
