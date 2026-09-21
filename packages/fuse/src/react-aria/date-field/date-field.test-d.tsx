import type { ComponentProps, ReactNode } from "react";

import type { CalendarDate } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/fuse";
import type * as DateFieldApi from "@elmeragroup/fuse/react-aria/date-field";
import type { DateFieldProps, DateInputProps } from "@elmeragroup/fuse/react-aria/date-field";
import { DateField, DateInput } from "@elmeragroup/fuse/react-aria/date-field";

test("DateField and DateInput are absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DateField");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DateInput");
});

test("the public value surface is exactly DateField and DateInput", () => {
  expectTypeOf(DateField).toBeFunction();
  expectTypeOf(DateInput).toBeFunction();
  expectTypeOf<typeof DateFieldApi.DateField>().toEqualTypeOf<typeof DateField>();
  expectTypeOf<typeof DateFieldApi.DateInput>().toEqualTypeOf<typeof DateInput>();
});

test("dateFieldVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof DateFieldApi>().not.toHaveProperty("dateFieldVariants");
  // @ts-expect-error DateSegment is not a public export
  type _NoSegment = DateFieldApi.DateSegment;
  // @ts-expect-error DateValue is not re-exported from this entry
  type _NoDateValue = DateFieldApi.DateValue;
  // @ts-expect-error ValidationResult is not re-exported from this entry
  type _NoValidation = DateFieldApi.ValidationResult;
  // @ts-expect-error RAC DateFieldProps is not leaked under a bare RAC name
  type _NoAria = DateFieldApi.AriaDateFieldProps;
});

test("DateFieldProps is generic, open, and accepts both error faces", () => {
  expectTypeOf<DateFieldProps<CalendarDate>["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DateFieldProps<CalendarDate>["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DateFieldProps<CalendarDate>["errorMessage"]>().toEqualTypeOf<
    ReactNode | ((validation: ValidationResult) => ReactNode) | undefined
  >();
  expectTypeOf<DateFieldProps<CalendarDate>["shouldForceLeadingZeros"]>().toEqualTypeOf<
    boolean | undefined
  >();
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("granularity");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("hourCycle");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("minValue");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("maxValue");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("placeholderValue");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("isDisabled");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("isReadOnly");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("isRequired");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("isInvalid");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("validate");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("name");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("autoFocus");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("className");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("aria-label");
  expectTypeOf<DateFieldProps<CalendarDate>>().toHaveProperty("validationBehavior");
  expectTypeOf<DateFieldProps<CalendarDate>>().not.toHaveProperty("size");
});

test("DateInput omits children and keeps slot plus open RAC props", () => {
  expectTypeOf<DateInputProps>().not.toHaveProperty("children");
  expectTypeOf<ComponentProps<typeof DateInput>>().not.toHaveProperty("children");
  expectTypeOf<DateInputProps>().toHaveProperty("slot");
  expectTypeOf<DateInputProps>().toHaveProperty("className");
  expectTypeOf<DateInputProps>().toHaveProperty("hidden");
  expectTypeOf<DateInputProps>().toHaveProperty("lang");
});

test("the elements take the public props and reject DateInput children and a size axis", () => {
  const _nodeError = <DateField label="Invoice date" errorMessage={<span>Required</span>} isInvalid />;
  const _functionError = (
    <DateField
      label="Invoice date"
      minValue={undefined}
      errorMessage={(result) => result.validationErrors.join(" ")}
    />
  );
  const _open = (
    <DateField
      label="Due"
      granularity="hour"
      hourCycle={24}
      isDisabled
      isReadOnly
      isRequired
      name="due"
      autoFocus
      aria-label="Due date"
      className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "gap-2")}
      onChange={(value) => {
        const _year: number | undefined = value?.year;
        return _year;
      }}
    />
  );
  const _input = (
    <DateInput slot="start" className={(renderProps) => (renderProps.isInvalid ? "ring" : "")} />
  );

  // @ts-expect-error DateInput always renders segments and omits children
  const _noChildren = <DateInput>{() => null}</DateInput>;
  // @ts-expect-error no size axis
  const _noSize = <DateField size="md" />;
});

test("there is no bare date-field entry", () => {
  // @ts-expect-error quarantined path only — never a bare date-field entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/fuse/date-field");
});
