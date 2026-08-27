import type { ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/ui";
import type * as CalendarApi from "@elmeragroup/ui/react-aria/calendar";
import type * as RangeCalendarApi from "@elmeragroup/ui/react-aria/range-calendar";
import type { RangeCalendarProps } from "@elmeragroup/ui/react-aria/range-calendar";
import { RangeCalendar } from "@elmeragroup/ui/react-aria/range-calendar";

test("RangeCalendar is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("RangeCalendar");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("RangeCalendarProps");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("rangeCalendarVariants");
});

test("the public value surface is exactly RangeCalendar", () => {
  expectTypeOf(RangeCalendar).toBeFunction();
  expectTypeOf<typeof RangeCalendarApi.RangeCalendar>().toEqualTypeOf<typeof RangeCalendar>();
  // The shared header parts stay on the calendar entry — this one never re-exports them.
  expectTypeOf<typeof RangeCalendarApi>().not.toHaveProperty("CalendarHeader");
  expectTypeOf<typeof RangeCalendarApi>().not.toHaveProperty("CalendarGridHeader");
  expectTypeOf<typeof CalendarApi>().not.toHaveProperty("RangeCalendar");
});

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

test("RangeCalendarProps is generic, open, omits owned children and visibleDuration, and takes a ReactNode error", () => {
  expectTypeOf<RangeCalendarProps<CalendarDate>["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("value");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("defaultValue");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("onChange");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("focusedValue");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("defaultFocusedValue");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("onFocusChange");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("minValue");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("maxValue");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("isDateUnavailable");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("allowsNonContiguousRanges");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("isDisabled");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("isReadOnly");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("isInvalid");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("autoFocus");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().toHaveProperty("className");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().not.toHaveProperty("children");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().not.toHaveProperty("visibleDuration");
  expectTypeOf<RangeCalendarProps<CalendarDate>>().not.toHaveProperty("size");
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

test("there is no bare range-calendar entry", () => {
  // @ts-expect-error quarantined path only — never a bare range-calendar entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/ui/range-calendar");
});
