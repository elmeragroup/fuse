import { CalendarDate } from "@internationalized/date";
import { expectTypeOf, test } from "vitest";

import type * as RangeCalendarApi from "@elmeragroup/fuse/react-aria/range-calendar";
import { RangeCalendar } from "@elmeragroup/fuse/react-aria/range-calendar";

test("rangeCalendarVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof RangeCalendarApi>().not.toHaveProperty("rangeCalendarVariants");
  expectTypeOf<typeof RangeCalendarApi>().not.toHaveProperty("getSelectionState");
  // @ts-expect-error DateValue is not re-exported from this entry
  type _NoDateValue = RangeCalendarApi.DateValue;
  // @ts-expect-error RangeValue is not re-exported from this entry
  type _NoRangeValue = RangeCalendarApi.RangeValue;
  // @ts-expect-error CalendarCell is not a public export
  type _NoCell = RangeCalendarApi.CalendarCell;
  // @ts-expect-error RAC RangeCalendarProps is not leaked under a bare RAC name
  type _NoAria = RangeCalendarApi.AriaRangeCalendarProps;
});

test("value and onChange speak the RangeValue shape", () => {
  const _range = (
    <RangeCalendar
      value={{ start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 17) }}
      onChange={(value) => {
        const _startYear: number = value.start.year;
        const _endDay: number = value.end.day;
        return _startYear + _endDay;
      }}
    />
  );
  const _open = (
    <RangeCalendar
      defaultValue={{ start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 17) }}
      minValue={new CalendarDate(2026, 7, 1)}
      maxValue={new CalendarDate(2026, 7, 31)}
      isDateUnavailable={(date) => date.day === 16}
      allowsNonContiguousRanges
      isDisabled
      isReadOnly
      isInvalid
      autoFocus
      className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "min-w-40")}
    />
  );
  const _nodeError = <RangeCalendar errorMessage={<span>Pick a valid range.</span>} isInvalid />;

  // @ts-expect-error a range needs both ends
  const _noHalfRange = <RangeCalendar value={{ start: new CalendarDate(2026, 7, 14) }} />;
  // @ts-expect-error single-month only — visibleDuration is omitted
  const _noDuration = <RangeCalendar visibleDuration={{ months: 2 }} />;
  const _noChildren = (
    // @ts-expect-error RangeCalendar owns its fixed children
    <RangeCalendar>
      <span>Unexpected child</span>
    </RangeCalendar>
  );
  // @ts-expect-error no size axis
  const _noSize = <RangeCalendar size="md" />;
  // @ts-expect-error RangeCalendar has no ValidationResult render face
  const _noFunctionError = <RangeCalendar errorMessage={() => "Pick a valid range."} />;
});
