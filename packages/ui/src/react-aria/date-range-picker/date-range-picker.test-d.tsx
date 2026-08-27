import type { ReactNode, RefObject } from "react";

import { CalendarDate } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/ui";
import type * as DateRangePickerApi from "@elmeragroup/ui/react-aria/date-range-picker";
import type { DateRangePickerProps } from "@elmeragroup/ui/react-aria/date-range-picker";
import { DateRangePicker } from "@elmeragroup/ui/react-aria/date-range-picker";

test("DateRangePicker is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DateRangePicker");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DateRangePickerProps");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("dateRangePickerVariants");
});

test("the public value surface is exactly the one documented name", () => {
  expectTypeOf(DateRangePicker).toBeFunction();
  expectTypeOf<typeof DateRangePickerApi.DateRangePicker>().toEqualTypeOf<typeof DateRangePicker>();
});

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

test("DateRangePickerProps declares the composite face and stays open on the RAC surface", () => {
  expectTypeOf<DateRangePickerProps<CalendarDate>["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DateRangePickerProps<CalendarDate>["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DateRangePickerProps<CalendarDate>["errorMessage"]>().toEqualTypeOf<
    ReactNode | ((validation: ValidationResult) => ReactNode) | undefined
  >();
  expectTypeOf<DateRangePickerProps<CalendarDate>["shouldForceLeadingZeros"]>().toEqualTypeOf<
    boolean | undefined
  >();
  expectTypeOf<DateRangePickerProps<CalendarDate>["container"]>().toEqualTypeOf<
    HTMLElement | RefObject<HTMLElement | null> | undefined
  >();
  // The value surface is RAC's RangeValue, not a bare date (§3).
  expectTypeOf<NonNullable<DateRangePickerProps<CalendarDate>["value"]>>().toEqualTypeOf<{
    start: CalendarDate;
    end: CalendarDate;
  }>();
  expectTypeOf<NonNullable<DateRangePickerProps<CalendarDate>["defaultValue"]>>().toEqualTypeOf<{
    start: CalendarDate;
    end: CalendarDate;
  }>();
  for (const prop of [
    "onChange",
    "minValue",
    "maxValue",
    "granularity",
    "placeholderValue",
    "isDisabled",
    "isReadOnly",
    "isRequired",
    "isInvalid",
    "isDateUnavailable",
    "allowsNonContiguousRanges",
    "validate",
    "validationBehavior",
    "startName",
    "endName",
    "isOpen",
    "onOpenChange",
    "shouldCloseOnSelect",
    "className",
    "aria-label",
  ] as const) {
    expectTypeOf<DateRangePickerProps<CalendarDate>>().toHaveProperty(prop);
  }
  // No preset pane on this side of the cluster, and no size axis anywhere in it (§3/§4).
  expectTypeOf<DateRangePickerProps<CalendarDate>>().not.toHaveProperty("presetGroup");
  expectTypeOf<DateRangePickerProps<CalendarDate>>().not.toHaveProperty("size");
  expectTypeOf<DateRangePickerProps<CalendarDate>>().not.toHaveProperty("visibleDuration");
});

test("the element takes the spec's props and rejects an invented axis", () => {
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

test("there is no bare date-range-picker entry", () => {
  // @ts-expect-error quarantined path only — never a bare date-range-picker entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/ui/date-range-picker");
});
