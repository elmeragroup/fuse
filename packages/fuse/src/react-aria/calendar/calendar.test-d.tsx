import { expectTypeOf, test } from "vitest";

import type * as CalendarApi from "@elmeragroup/fuse/react-aria/calendar";
import { Calendar, CalendarGridHeader, CalendarHeader } from "@elmeragroup/fuse/react-aria/calendar";

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

test("the elements take the public props and reject children, visibleDuration, a size axis, and header props", () => {
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
