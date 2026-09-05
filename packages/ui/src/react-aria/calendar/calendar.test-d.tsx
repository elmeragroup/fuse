import type { ReactNode } from "react";

import type { CalendarDate } from "@internationalized/date";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/ui";
import type * as CalendarApi from "@elmeragroup/ui/react-aria/calendar";
import type { CalendarProps } from "@elmeragroup/ui/react-aria/calendar";
import { Calendar, CalendarGridHeader, CalendarHeader } from "@elmeragroup/ui/react-aria/calendar";

test("Calendar and header parts are absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("Calendar");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("CalendarHeader");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("CalendarGridHeader");
});

test("the public value surface is exactly Calendar, CalendarHeader, and CalendarGridHeader", () => {
  expectTypeOf(Calendar).toBeFunction();
  expectTypeOf(CalendarHeader).toBeFunction();
  expectTypeOf(CalendarGridHeader).toBeFunction();
  expectTypeOf<typeof CalendarApi.Calendar>().toEqualTypeOf<typeof Calendar>();
  expectTypeOf<typeof CalendarApi.CalendarHeader>().toEqualTypeOf<typeof CalendarHeader>();
  expectTypeOf<typeof CalendarApi.CalendarGridHeader>().toEqualTypeOf<typeof CalendarGridHeader>();
});

test("calendarVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof CalendarApi>().not.toHaveProperty("calendarVariants");
  expectTypeOf<typeof CalendarApi>().not.toHaveProperty("cellVariants");
  // @ts-expect-error DateValue is not re-exported from this entry
  type _NoDateValue = CalendarApi.DateValue;
  // @ts-expect-error CalendarCell is not a public export
  type _NoCell = CalendarApi.CalendarCell;
  // @ts-expect-error RAC CalendarProps is not leaked under a bare RAC name
  type _NoAria = CalendarApi.AriaCalendarProps;
  // @ts-expect-error CalendarHeaderProps is not a public type
  type _NoHeaderProps = CalendarApi.CalendarHeaderProps;
  // @ts-expect-error CalendarGridHeaderProps is not a public type
  type _NoGridHeaderProps = CalendarApi.CalendarGridHeaderProps;
});

test("CalendarProps is generic, open, omits owned children and visibleDuration, and takes a ReactNode error", () => {
  expectTypeOf<CalendarProps<CalendarDate>["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("value");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("defaultValue");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("onChange");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("focusedValue");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("defaultFocusedValue");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("onFocusChange");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("minValue");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("maxValue");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("isDateUnavailable");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("isDisabled");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("isReadOnly");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("isInvalid");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("firstDayOfWeek");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("autoFocus");
  expectTypeOf<CalendarProps<CalendarDate>>().toHaveProperty("className");
  expectTypeOf<CalendarProps<CalendarDate>>().not.toHaveProperty("children");
  expectTypeOf<CalendarProps<CalendarDate>>().not.toHaveProperty("visibleDuration");
  expectTypeOf<CalendarProps<CalendarDate>>().not.toHaveProperty("size");
});

test("header parts take no props", () => {
  expectTypeOf(CalendarHeader).parameters.toEqualTypeOf<[]>();
  expectTypeOf(CalendarGridHeader).parameters.toEqualTypeOf<[]>();
});

test("the elements take the spec's props and reject children, visibleDuration, a size axis, and header props", () => {
  const _nodeError = (
    <Calendar errorMessage={<span>Pick a valid day.</span>} isInvalid defaultValue={undefined} />
  );
  const _open = (
    <Calendar
      minValue={undefined}
      maxValue={undefined}
      isDisabled
      isReadOnly
      isInvalid
      autoFocus
      firstDayOfWeek="mon"
      className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "min-w-32")}
      onChange={(value) => {
        const _year: number = value.year;
        return _year;
      }}
    />
  );
  const _headers = (
    <>
      <CalendarHeader />
      <CalendarGridHeader />
    </>
  );

  // @ts-expect-error single-month only — visibleDuration is omitted
  const _noDuration = <Calendar visibleDuration={{ months: 2 }} />;
  const _noChildren = (
    // @ts-expect-error Calendar owns its fixed children
    <Calendar>
      <span>Unexpected child</span>
    </Calendar>
  );
  // @ts-expect-error no size axis
  const _noSize = <Calendar size="md" />;
  // @ts-expect-error Calendar has no ValidationResult render face
  const _noFunctionError = <Calendar errorMessage={() => "Pick a valid day."} />;
  // @ts-expect-error CalendarHeader takes no props
  const _noHeaderClass = <CalendarHeader className="px-2" />;
  // @ts-expect-error CalendarGridHeader takes no props
  const _noGridHeaderClass = <CalendarGridHeader className="text-xs" />;
});

test("there is no bare calendar entry", () => {
  // @ts-expect-error quarantined path only — never a bare calendar entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/ui/calendar");
});
