---
"@elmeragroup/fuse": minor
---

Adds `DatePickerField` and the `DatePicker` parts from `@elmeragroup/fuse/date-picker`, and
`DateRangePickerField` and the `DateRangePicker` parts from `@elmeragroup/fuse/date-range-picker`,
both in the root entry: a date field with a calendar popup, and start and end fields with a range
calendar popup, whose values are Temporal values. They are the Temporal replacements for the
interim `@elmeragroup/fuse/react-aria/date-picker` and `react-aria/date-range-picker`, which stay
unchanged.

```tsx
import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";
import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

<DatePickerField label="Moving date" name="moving" defaultValue={Temporal.PlainDate.from("2026-10-05")} />;
<DateRangePickerField
  label="Maintenance window"
  startName="from"
  endName="to"
  granularity="minute"
  hourCycle={24}
  hideTimeZone
  timeZone="Europe/Oslo"
  visibleMonths={2}
/>;
```

- The composites keep the interim prop names (`label`, `description`, `errorMessage`, `isInvalid`,
  `isDisabled`, `isReadOnly`, `isRequired`, `value`, `defaultValue`, `onChange`, `minValue`,
  `maxValue`, `isDateUnavailable`, `granularity`, `hourCycle`, `hideTimeZone`, `firstDayOfWeek`,
  `presetGroup`, `triggerPlacement`, `startName`, `endName`, `size`, `isOpen`, `defaultOpen`,
  `onOpenChange`, `onBlur`, `aria-label`), and add `timeZone` and `visibleMonths`. Values are
  Temporal objects from any implementation, never their ISO text, built in a client component, as
  for `Calendar`. The composites hold no state, so a server component renders them without a date
  value.
- The value kind is typed as `DateField`'s, with no type argument: a `value` or `defaultValue`
  names it, and without either `granularity` and `timeZone` do, so the range picker above reports
  ranges of `Temporal.ZonedDateTime`.
- The trigger and the popup `dialog` are named "Calendar" and the label, as React Aria names them.
  Opening moves focus to the selected day, or today, and closing returns it; Alt+ArrowDown in the
  field opens the popup. Picking a day keeps the value's time and zone, and until a value names its kind,
  an empty picker follows `granularity` and `timeZone`, typed and picked alike. Escape in a range calendar
  drops a half-picked range first and closes the popup on the next press.
- Each end of a range picker is a Field of its own under `startName` and `endName`, so a `Form`
  submits both ISO values and focuses the end whose error it returns; the label, the description
  and one merged error describe both. An end typed before its start, or a start typed past its
  end, reports "Start date must be before end date." on the end. A whole range that loses an end
  reports `null`, as React Aria does, and the other end stays in its input.
- A disabled `Field.Root` or `Field.Set` around a picker disables it whole (trigger, calendar,
  presets), in server output too.
- Presets: `DatePicker.Presets` and `DatePicker.PresetItem` (`DateRangePicker.Presets`,
  `.PresetItem`) are native radios inside their labels, with a controlled `value`, `disabled` items
  and `closeOnDoubleClick` (the interim `isCloseDialogOnDoubleClick`). The interim
  `DatePickerPresetGroup`'s `onChange` and `isDisabled` are `onValueChange` and `disabled` here;
  `onValueChange` passes the key and cancelable details (`reason: "preset-press"`).
- The parts use Base UI's names (`value`, `onValueChange`, `open`, `onOpenChange`, `disabled`,
  `readOnly`, `required`, `invalid`, `render`). `onValueChange` and `onOpenChange` pass details
  with a `reason` (`"day-press"`, `"keyboard"`, `"input-change"`, … and Base UI Popover's
  `"trigger-press"`, `"escape-key"`, `"outside-press"`, plus `"preset-press"`) and `cancel()`;
  React Aria has no equivalent.
