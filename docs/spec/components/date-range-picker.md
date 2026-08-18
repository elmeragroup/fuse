# DateRangePicker

## 1 Header

- **Canonical name:** `DateRangePicker`
- **Export path:** `@elmeragroup/ui/react-aria/date-range-picker` — `react-aria/` quarantine prefix (path-policy ruling).
- **Tier:** **react-aria interim** — labeled composite over `react-aria-components` `DateRangePicker`. **Migration roadmap:** replaced by a base-ui composition alongside DatePicker; bare `@elmeragroup/ui/date-range-picker` is reserved for the successor.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/date-range-picker.tsx` (+ `styles/date-picker.ts` as the shape template for the new recipe — see §4).

## 2 Anatomy

```
AriaDateRangePicker                    (RAC DateRangePicker; base slot)
├─ Label                               — when `label`
├─ FieldGroup (group slot, min-w-[208px])
│  ├─ DateInput slot="start"           — public, from react-aria/date-field
│  ├─ span "–" (aria-hidden, en dash separator)
│  ├─ DateInput slot="end" (flex-1)
│  └─ Button variant="ghost" size="icon-sm" > Icon.Calendar (Phosphor CalendarBlank, aria-hidden)
├─ Description / FieldError            — as DatePicker
└─ Popover                             (private RAC popover internal; stamps OVERLAY_CONTAINER_ATTR)
   └─ Dialog closeButton={false}       (private STYLED dialog — ruled alignment; ref used raw RAC Dialog)
      └─ RangeCalendar (calendar slot) — public, from react-aria/range-calendar
```

Composes the same private internals as DatePicker (styled Dialog, Modal, RAC Button for slots, RAC Popover) — all stay private and die with the tier. The popover participates in the `OVERLAY_CONTAINER_ATTR` seam documented in date-picker §6: interactions inside this popover never dismiss a host Modal.

## 3 Props

`DateRangePickerProps<T extends DateValue>` — spreads onto RAC `DateRangePicker` (open surface: `value`/`defaultValue`/`onChange` as `RangeValue<T>` `{ start, end }`, `minValue`, `maxValue`, `granularity`, `placeholderValue`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `isDateUnavailable`, `allowsNonContiguousRanges`, `validate`, `startName`/`endName`, `isOpen`/`onOpenChange`, …).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | — | |
| `description` | `string` | — | |
| `errorMessage` | `string \| ((v: ValidationResult) => string)` | — | RAC FieldError face, kept (interim exception to `ReactNode` convention) |
| `isReadOnly` | `boolean` | `false` | Destructured to drive the `isReadOnly` tv variant (ruled addition — parity with DatePicker) |
| `shouldForceLeadingZeros` | `boolean` | **`true`** | **Ruled addition** — the ref omits it here while DatePicker/DateField default it true; aligned |
| `className` | RAC className | — | Composed onto `base` slot |

No `presetGroup` (DatePicker-only; DatePickerStateContext has no range counterpart in this tier).

## 4 Variants

**Ruled addition:** `dateRangePickerVariants` in `styles/date-range-picker.ts`, **module-private**, mirroring `datePickerVariants`' shape exactly — slots `base` (`group flex flex-col gap-1`), `group` (`w-auto min-w-[208px]`), `input` (`px-2 py-1.5 text-sm`; end input adds `flex-1`), `separator` (the en-dash span, absorbing the ref's inline classes), `icon` (`size-4 transition-colors`), `dialog` (`p-0`), `calendar` — with the `isReadOnly` axis (`bg-muted` on `group`/`icon`). The ref styles everything inline with zero recipe; the recipe is the alignment ruling made concrete.

## 5 Consumed tokens

Own slots: `foreground` (separator — ref `text-gray-800`), `muted-foreground` (disabled separator — ref `group-disabled:text-gray-200`), `muted` (read-only fill). Via composed parts: `background`/`input`/`ring`/`error` (FieldGroup + FieldError), `card` (popover surface), `primary` family + `muted`/`accent` (RangeCalendar cells per its §5 mapping). Forced-colors separator fallbacks (`[ButtonText]`/`[GrayText]`) kept.

## 6 Data attributes

- **Emitted:** RAC state attributes on root/group/inputs/cells (`data-open`, `data-invalid`, `data-disabled`, …). The separator relies on the root's `group` class + RAC `group-disabled:` modifier.
- **Consumed:** the popover internal stamps `data-overlay-container="popover"` via the shared **`OVERLAY_CONTAINER_ATTR`** constant; the modal internal's `shouldCloseOnInteractOutside` reads it through `closest()`. Full mechanism documented in date-picker §6 — this component is the second beneficiary.

## 7 Accessibility

- RAC DateRangePicker semantics: one labeled group containing two segment groups (start/end), each of whose segments are `spinbutton`s; the en-dash separator is `aria-hidden` (RAC announces "start date"/"end date" itself).
- Trigger button: RAC-provided name, `aria-expanded`; popover contains a `dialog` wrapping the range `grid`.
- Keyboard: segment editing per DateField in both inputs; trigger opens the dialog with focus on the grid; range selection per RangeCalendar §7 (anchor → extend → commit, Escape cancels); committing the range closes the popover and returns focus.
- Invalid ranges (`end < start`, unavailable spans) drive `FieldError`, including the `(v: ValidationResult) => string` face.

## 8 Divergence from reference

1. **Export path quarantine:** `./date-range-picker` → `react-aria/date-range-picker`.
2. **Styled Dialog (ruled):** ref imports raw `Dialog` from `react-aria-components` — its popover content skipped the cluster's dialog chrome entirely; aligned to the private styled `Dialog` with `closeButton={false}` and `p-0` dialog slot, matching DatePicker.
3. **`shouldForceLeadingZeros = true` default (ruled):** ref omits it, contradicting DatePicker/DateField; aligned.
4. **Token renames (ruled):** separator `text-gray-800` → `text-foreground`, `group-disabled:text-gray-200` → `text-muted-foreground`.
5. **`dateRangePickerVariants` recipe added (ruled):** shape-matched to `datePickerVariants` (§4), replacing all-inline styling; includes the `isReadOnly` axis the ref lacks here.
6. **Trigger size aligned:** ref uses `size="icon"` where DatePicker uses `size="icon-sm"` with an explicit `size-4` icon; normalized to `icon-sm` as part of the parity ruling.
7. **Icon swap:** `Icon.Calendar` → Phosphor `CalendarBlank` (cluster-wide choice, stated in date-picker §8).
8. **Kept:** `errorMessage` string/function face; open RAC prop spread; no preset support; private internals private.
9. **Interim-only devDependency:** `tailwindcss-react-aria-components` modifiers (`group-disabled:` et al.) die with the tier.

## 9 Test requirements

- Role/label queries: group by label; two segment groups' `spinbutton`s (start/end); trigger `button`; popover `dialog`; days by `gridcell`.
- Segment editing in both inputs fires `onChange` with `{ start, end }` once both are complete; leading zeros render by default.
- Open/select flow: trigger opens dialog; select start then end in the grid → `onChange` fires with the range and the popover closes; Escape mid-selection cancels and returns focus to the trigger.
- Invalid range (end before start) sets `data-invalid` and renders `errorMessage` (string and function forms).
- Overlay seam regression: DateRangePicker inside a Modal — selecting range endpoints must not dismiss the Modal (`OVERLAY_CONTAINER_ATTR`).
- `isReadOnly`: segments inert, `bg-muted` group, popover does not open; `startName`/`endName` submit ISO strings in a form.

## 10 Demo requirements

Plain `.tsx` demos: `date-range-picker-basic` (label/description), `date-range-picker-controlled` (value + onChange), `date-range-picker-validation` (min/max + unavailable dates + function errorMessage), `date-range-picker-states` (disabled, read-only, required), `date-range-picker-in-modal` (overlay-container seam showcase).
