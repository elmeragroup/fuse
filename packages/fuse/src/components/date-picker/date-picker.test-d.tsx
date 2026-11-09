import { expectTypeOf, test } from "vitest";

import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";
import type {
  DatePickerOpenChangeReason,
  DatePickerPresetsValueChangeEventDetails,
  DatePickerValidationError,
  DatePickerValueChangeReason,
} from "@elmeragroup/fuse/date-picker";
import { DateRangePicker, DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
import type {
  DateRangePickerValidationError,
  DateRangePickerValue,
  DateRangePickerValueChangeReason,
} from "@elmeragroup/fuse/date-range-picker";

test("DatePickerField reports a PlainDate by default, and the kind its type argument names", () => {
  const _default = (
    <DatePickerField
      label="Start date"
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>();
      }}
    />
  );
  const _zoned = (
    <DatePickerField<Temporal.ZonedDateTime>
      label="Starts"
      granularity="minute"
      timeZone="Europe/Oslo"
      minValue="2026-10-01T00:00[Europe/Oslo]"
      maxValue={Temporal.PlainDateTime.from("2026-10-31T23:30")}
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime | null>();
      }}
      isDateUnavailable={(value) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.ZonedDateTime>();
        return false;
      }}
    />
  );
  // @ts-expect-error a picker holds a Temporal value, not a Date
  const _date = <DatePickerField label="Start date" value={new Date()} />;
  // @ts-expect-error the trigger sits at the start or the end
  const _placement = <DatePickerField label="Start date" triggerPlacement="middle" />;
});

test("DatePicker.Root passes cancelable details with its reasons", () => {
  const _root = (
    <DatePicker.Root<Temporal.PlainDate>
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<Temporal.PlainDate | null>();
        expectTypeOf(details.reason).toEqualTypeOf<DatePickerValueChangeReason>();
        expectTypeOf(details.getValidationError()).toEqualTypeOf<DatePickerValidationError | null>();
        expectTypeOf(details.cancel).toEqualTypeOf<() => void>();
      }}
      onOpenChange={(open, details) => {
        expectTypeOf(open).toEqualTypeOf<boolean>();
        expectTypeOf(details.reason).toEqualTypeOf<DatePickerOpenChangeReason>();
      }}
    />
  );
  // @ts-expect-error the Input takes its value from the Root
  const _input = <DatePicker.Input value="2026-10-05" />;
  // @ts-expect-error a preset item needs its key
  const _preset = <DatePicker.PresetItem>Today</DatePicker.PresetItem>;
});

test("DatePicker.Presets passes the key and cancelable details, as the picker's callbacks do", () => {
  const _presets = (
    <DatePicker.Presets
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<string>();
        expectTypeOf(details).toEqualTypeOf<DatePickerPresetsValueChangeEventDetails>();
        expectTypeOf(details.reason).toEqualTypeOf<"preset-press">();
        expectTypeOf(details.trigger).toEqualTypeOf<Element | undefined>();
        expectTypeOf(details.cancel).toEqualTypeOf<() => void>();
      }}
    />
  );
});

test("DateRangePickerField reports a range of its kind", () => {
  const _range = (
    <DateRangePickerField<Temporal.PlainDateTime>
      label="Period"
      startName="from"
      endName="to"
      granularity="minute"
      defaultValue={{ start: "2026-10-05T08:00", end: Temporal.PlainDateTime.from("2026-10-09T17:00") }}
      onChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDateTime> | null>();
      }}
    />
  );
  const _root = (
    <DateRangePicker.Root
      onValueChange={(value, details) => {
        expectTypeOf(value).toEqualTypeOf<DateRangePickerValue<Temporal.PlainDate> | null>();
        expectTypeOf(details.reason).toEqualTypeOf<DateRangePickerValueChangeReason>();
        expectTypeOf(details.getValidationError()).toEqualTypeOf<DateRangePickerValidationError | null>();
      }}
    />
  );
  // @ts-expect-error a range needs both ends
  const _half = <DateRangePickerField label="Period" value={{ start: "2026-10-05" }} />;
});
