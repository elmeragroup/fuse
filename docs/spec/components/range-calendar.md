# RangeCalendar

## 1 Header

- **Canonical name:** `RangeCalendar`
- **Export path:** `@elmeragroup/ui/react-aria/range-calendar` — `react-aria/` quarantine prefix (path-policy ruling).
- **RSC:** client
- **Tier:** **react-aria interim** — composite over `react-aria-components` `RangeCalendar`. **Public by user ruling** (zero-usage evidence overridden — deliberate API addition). **Migration roadmap:** replaced alongside Calendar by a base-ui/custom implementation; bare `@elmeragroup/ui/range-calendar` is reserved for the successor.
- **Source of truth:** `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/range-calendar.tsx` (+ `calendar.tsx`/`styles/calendar.ts` for the shared header parts).

## 2 Anatomy

```
AriaRangeCalendar                  (RAC RangeCalendar)
├─ CalendarHeader                  (shared export from react-aria/calendar)
│  ├─ Button slot="previous" > CaretLeft        (named icon import; private RAC Button; RTL flips)
│  ├─ Heading (size="lg")
│  └─ Button slot="next" > CaretRight           (named icon import)
├─ CalendarGrid ([&_td]:px-0)
│  ├─ CalendarGridHeader           (shared export from react-aria/calendar)
│  └─ CalendarGridBody > CalendarCell (render prop per date)
│     └─ span                      (inner pill; selectionState-driven fill)
└─ Text slot="errorMessage"        — when `errorMessage`
```

Two-layer cell geometry (kept): the outer `CalendarCell` is a square `size-9` band that carries the range fill (`selected:` background, `selection-start:/selection-end:` end-caps, `[td:first-child_&]`/`[td:last-child_&]` row-edge rounding); the inner `span` is the full-size `rounded-full` pill whose fill is computed by `getSelectionState(isSelected, isSelectionStart, isSelectionEnd)` → `"none" | "middle" | "cap"`.

## 3 Props

`RangeCalendarProps<T extends DateValue>` — spreads onto RAC `RangeCalendar` with `visibleDuration` omitted (single month). Open RAC surface: `value`/`defaultValue`/`onChange` (all `RangeValue<DateValue>`: `{ start, end }`), `focusedValue`, `onFocusChange`, `minValue`, `maxValue`, `isDateUnavailable`, `allowsNonContiguousRanges`, `isDisabled`, `isReadOnly`, `isInvalid`, `autoFocus`, …

| Prop           | Type          | Default | Notes                                                      |
| -------------- | ------------- | ------- | ---------------------------------------------------------- |
| `errorMessage` | `ReactNode`   | —       | same face as Calendar; renders `Text slot="errorMessage"`  |
| `className`    | RAC className | —       | Spread onto the root (ref applies no root recipe — see §8) |

## 4 Variants

`rangeCalendarVariants` — **moved to `styles/range-calendar.ts`** (the ref defines an inline `tv()` inside the component file; every sibling keeps recipes in `styles/` — locked ruling). Slotted recipe, **module-private**. The inner-pill `cell` slot composes `focusRing({ target: "state", isFocusVisible })`; axes: `selectionState` (`none`/`middle`/`cap`) and `isDisabled`. The outer-cell class string joins the recipe as an `outerCell` slot so no styling stays inline. No public recipe export.

## 5 Consumed tokens

Locked palette mapping (ref raw grays/blues → contract tokens, `no-primitive-colors` guardrail applies to interim code):

- `none` hover `bg-gray-100` → `bg-muted`; pressed `bg-gray-200` → `bg-accent` (muted/accent family for un-selected interaction, matching Calendar).
- `middle` band: `bg-primary/20` (kept), hover `bg-primary/30` (kept), pressed `bg-blue-300` → `bg-primary/40` (primary family — pressed sits one step above hover).
- `cap`: `bg-primary`, `text-white` → `text-primary-foreground`.
- Disabled/outside-month `text-gray-300` → `text-muted-foreground`.
- Invalid: `destructive` → `error` (`error/10` band, `error/20` hover, `error/30` pressed, `bg-error` caps, `text-error` message).
- Plus `foreground` (pill text), `ring` (focusRing). Forced-colors (`[Highlight]`, `[Mark]`) kept.

## 6 Data attributes

- **Emitted:** RAC attributes — `data-selected`, `data-selection-start`, `data-selection-end`, `data-outside-month`, `data-disabled`, `data-unavailable`, `data-invalid`, `data-pressed`, `data-focused` on cells. No custom `data-slot` in the ref; none added.
- **Consumed:** the outer cell styles against RAC attributes through plugin modifiers (`selected:`, `invalid:selected:`, `selection-start:`, `selection-end:`, `outside-month:`); the inner pill uses `group-hover:`/`group-pressed:` against the outer cell's group state. All plugin-provided (see §8).

## 7 Accessibility

- RAC range-grid semantics: `role="grid"`/`gridcell`; heading labels the visible month; selected cells expose `aria-selected`.
- Keyboard per RAC: Arrows move day focus; Enter/Space anchors the range start, second Enter/Space commits the end; while anchored, arrow movement extends the highlighted range; Escape cancels an in-progress selection; PageUp/PageDown month nav; Home/End week bounds.
- Default non-contiguous rule: while a range is being selected, RAC clamps the highlight at the nearest unavailable dates around the anchor, so an interactive range never crosses an unavailable date; `allowsNonContiguousRanges` lifts the clamp. The calendar is invalid when a range endpoint is unavailable or outside `minValue`/`maxValue` (e.g. a provided value starting on an unavailable date); `errorMessage` text is associated via the `errorMessage` slot.
- Nav buttons and RTL behavior inherited from the shared `CalendarHeader` (see calendar spec §7).

## 8 Divergence from reference

1. **Becomes a public export** (user ruling — deliberate API addition, overriding zero-usage evidence).
2. **Inline `tv()` moves to `styles/range-calendar.ts`** as `rangeCalendarVariants`, matching every sibling; the raw outer-cell class string becomes a recipe slot.
3. **Palette → tokens** per §5: `bg-gray-100/200` → `muted`/`accent`, `bg-blue-300` → `primary/40`, `text-gray-300` → `muted-foreground`, `text-white` → `primary-foreground`, `destructive` → `error`.
4. **Icon swaps** (via shared `CalendarHeader`): lucide chevrons → Phosphor `CaretLeft`/`CaretRight`.
5. **Kept:** two-layer cell geometry; `visibleDuration` omitted. `errorMessage` widens from string to ReactNode. RangeCalendar hand-rolls its own cell recipe instead of reusing `calendarVariants`' cell, and unlike Calendar its root takes no card-surface recipe — standalone it renders borderless; picker dialog supplies chrome.
6. **Interim-only regular dependency:** RAC state modifiers come from `tailwindcss-react-aria-components`; the plugin uninstalls with the tier.

## 9 Test requirements

- Role queries: `getByRole("grid")`, `getAllByRole("gridcell")`, nav buttons by accessible name, heading by role.
- Range keyboard per §7: Enter anchors start → ArrowRight ×3 → Enter commits; `onChange` fires once with `{ start, end }`; Escape mid-selection restores the previous value.
- Pointer: click start, click end; cells between expose `aria-selected="true"`; start/end cells carry `data-selection-start`/`data-selection-end`.
- `isDateUnavailable` + default non-contiguous rule: keyboard selection clamps before the unavailable date; with `allowsNonContiguousRanges` the same keystrokes span it; a value whose endpoint is unavailable marks the calendar invalid and `errorMessage` renders and is referenced by `aria-describedby`.
- `minValue`/`maxValue` disable out-of-range cells and clamp month navigation.

## 10 Demo requirements

Plain `.tsx` demos: `range-calendar-basic` (uncontrolled defaultValue range), `range-calendar-controlled` (value + onChange), `range-calendar-unavailable` (isDateUnavailable + allowsNonContiguousRanges toggle), `range-calendar-error` (invalid span + errorMessage), `range-calendar-bounds` (min/max clamped navigation).
