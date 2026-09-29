import { CalendarDate } from "@internationalized/date";
import { expectTypeOf, test } from "vitest";

import type * as DateRangePickerApi from "@elmeragroup/fuse/react-aria/date-range-picker";
import { DateRangePicker } from "@elmeragroup/fuse/react-aria/date-range-picker";

test("no private overlay part, recipe, or RAC type leaks through the entry", () => {
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("dateRangePickerVariants");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("Popover");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("Dialog");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("Modal");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("Button");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("FieldGroup");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("RangeCalendar");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("DateInput");
  expectTypeOf<typeof DateRangePickerApi>().not.toHaveProperty("OVERLAY_CONTAINER_ATTR");
  // @ts-expect-error DateValue is not re-exported from this entry
  type _NoDateValue = DateRangePickerApi.DateValue;
  // @ts-expect-error RangeValue is not re-exported from this entry
  type _NoRangeValue = DateRangePickerApi.RangeValue;
  // @ts-expect-error ValidationResult is not re-exported from this entry
  type _NoValidation = DateRangePickerApi.ValidationResult;
  // @ts-expect-error DateRangePickerStateContext is not a public export
  type _NoStateContext = DateRangePickerApi.DateRangePickerStateContext;
  // @ts-expect-error RAC DateRangePickerProps is not leaked under a bare RAC name
  type _NoAria = DateRangePickerApi.AriaDateRangePickerProps;
});

test("the element takes the public props and rejects an invented axis", () => {
  const july = { start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 21) };
  const _basic = (
    <DateRangePicker label="Delivery window" description="When we may deliver." defaultValue={july} />
  );
  const _nodeError = (
    <DateRangePicker errorMessage={<span>Required</span>} isInvalid label="Delivery window" />
  );
  const _functionError = (
    <DateRangePicker
      errorMessage={(validation) => validation.validationErrors.join(" ")}
      label="Delivery window"
      minValue={new CalendarDate(2026, 7, 1)}
    />
  );
  const _open = (
    <DateRangePicker
      aria-label="Delivery window"
      allowsNonContiguousRanges
      granularity="day"
      isDisabled
      isReadOnly
      isRequired
      isDateUnavailable={(date) => date.day === 16}
      startName="from"
      endName="to"
      shouldForceLeadingZeros={false}
      className={(renderProps) => (renderProps.isOpen ? "gap-4" : "gap-2")}
      onChange={(value) => {
        const _year: number | undefined = value?.start.year;
        return _year;
      }}
    />
  );
  const _container = <DateRangePicker container={document.body} label="Delivery window" />;

  // @ts-expect-error no size axis
  const _noSize = <DateRangePicker label="Delivery window" size="md" />;
  // @ts-expect-error presets are DatePicker's alone
  const _noPresets = <DateRangePicker label="Delivery window" presetGroup={<span>Today</span>} />;
  // @ts-expect-error the value surface is a range, never a single date
  const _noSingleValue = <DateRangePicker label="Delivery window" value={new CalendarDate(2026, 7, 14)} />;
  // @ts-expect-error container takes an element or a ref, never a selector
  const _noSelector = <DateRangePicker container="#overlays" label="Delivery window" />;
});
