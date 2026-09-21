import type { ReactNode, RefObject } from "react";

import { CalendarDate } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/fuse";
import type * as DatePickerApi from "@elmeragroup/fuse/react-aria/date-picker";
import type {
  DatePickerPresetGroupProps,
  DatePickerPresetItemProps,
  DatePickerProps,
} from "@elmeragroup/fuse/react-aria/date-picker";
import {
  DatePicker,
  DatePickerPresetGroup,
  DatePickerPresetItem,
} from "@elmeragroup/fuse/react-aria/date-picker";

test("the date-picker family is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DatePicker");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DatePickerPresetGroup");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DatePickerPresetItem");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("DatePickerProps");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("datePickerVariants");
});

test("the public value surface is exactly the three documented names", () => {
  expectTypeOf(DatePicker).toBeFunction();
  expectTypeOf(DatePickerPresetGroup).toBeFunction();
  expectTypeOf(DatePickerPresetItem).toBeFunction();
  expectTypeOf<typeof DatePickerApi.DatePicker>().toEqualTypeOf<typeof DatePicker>();
  expectTypeOf<typeof DatePickerApi.DatePickerPresetGroup>().toEqualTypeOf<typeof DatePickerPresetGroup>();
  expectTypeOf<typeof DatePickerApi.DatePickerPresetItem>().toEqualTypeOf<typeof DatePickerPresetItem>();
});

test("no private overlay part, recipe, or RAC type leaks through the entry", () => {
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("datePickerVariants");
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("Popover");
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("Dialog");
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("Modal");
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("Button");
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("FieldGroup");
  expectTypeOf<typeof DatePickerApi>().not.toHaveProperty("OVERLAY_CONTAINER_ATTR");
  // @ts-expect-error DateValue is not re-exported from this entry
  type _NoDateValue = DatePickerApi.DateValue;
  // @ts-expect-error ValidationResult is not re-exported from this entry
  type _NoValidation = DatePickerApi.ValidationResult;
  // @ts-expect-error DatePickerStateContext is not a public export
  type _NoStateContext = DatePickerApi.DatePickerStateContext;
  // @ts-expect-error RAC DatePickerProps is not leaked under a bare RAC name
  type _NoAria = DatePickerApi.AriaDatePickerProps;
});

test("DatePickerProps declares the composite face and stays open on the RAC surface", () => {
  expectTypeOf<DatePickerProps<CalendarDate>["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DatePickerProps<CalendarDate>["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DatePickerProps<CalendarDate>["errorMessage"]>().toEqualTypeOf<
    ReactNode | ((validation: ValidationResult) => ReactNode) | undefined
  >();
  // Widened to allow an explicit null.
  expectTypeOf<DatePickerProps<CalendarDate>["defaultValue"]>().toEqualTypeOf<
    CalendarDate | null | undefined
  >();
  expectTypeOf<DatePickerProps<CalendarDate>["presetGroup"]>().toEqualTypeOf<ReactNode>();
  expectTypeOf<DatePickerProps<CalendarDate>["shouldForceLeadingZeros"]>().toEqualTypeOf<
    boolean | undefined
  >();
  expectTypeOf<DatePickerProps<CalendarDate>["container"]>().toEqualTypeOf<
    HTMLElement | RefObject<HTMLElement | null> | undefined
  >();
  for (const prop of [
    "value",
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
    "validate",
    "validationBehavior",
    "name",
    "isOpen",
    "onOpenChange",
    "shouldCloseOnSelect",
    "className",
    "aria-label",
  ] as const) {
    expectTypeOf<DatePickerProps<CalendarDate>>().toHaveProperty(prop);
  }
  expectTypeOf<DatePickerProps<CalendarDate>>().not.toHaveProperty("size");
  expectTypeOf<DatePickerProps<CalendarDate>>().not.toHaveProperty("presetGroupLabel");
});

test("the preset parts declare the label, description and double-click faces", () => {
  expectTypeOf<DatePickerPresetGroupProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DatePickerPresetGroupProps>().toHaveProperty("value");
  expectTypeOf<DatePickerPresetGroupProps>().toHaveProperty("onChange");
  expectTypeOf<DatePickerPresetGroupProps>().toHaveProperty("children");
  expectTypeOf<DatePickerPresetItemProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DatePickerPresetItemProps["isCloseDialogOnDoubleClick"]>().toEqualTypeOf<
    boolean | undefined
  >();
  expectTypeOf<DatePickerPresetItemProps>().toHaveProperty("value");
  expectTypeOf<DatePickerPresetItemProps>().toHaveProperty("onDoubleClick");
  expectTypeOf<DatePickerPresetItemProps>().toHaveProperty("children");
});

test("the elements take the public props and reject an invented axis", () => {
  const _basic = (
    <DatePicker
      label="Invoice date"
      description="Billing date."
      defaultValue={new CalendarDate(2026, 7, 14)}
    />
  );
  const _nulled = <DatePicker defaultValue={null} label="Invoice date" />;
  const _nodeError = <DatePicker errorMessage={<span>Required</span>} isInvalid label="Invoice date" />;
  const _functionError = (
    <DatePicker
      errorMessage={(validation) => validation.validationErrors.join(" ")}
      label="Invoice date"
      minValue={new CalendarDate(2026, 7, 1)}
    />
  );
  const _open = (
    <DatePicker
      aria-label="Invoice date"
      granularity="day"
      isDisabled
      isReadOnly
      isRequired
      isDateUnavailable={(date) => date.day === 16}
      name="invoice"
      shouldForceLeadingZeros={false}
      className={(renderProps) => (renderProps.isOpen ? "gap-4" : "gap-2")}
      onChange={(value) => {
        const _year: number | undefined = value?.year;
        return _year;
      }}
    />
  );
  const _presets = (
    <DatePicker
      label="Invoice date"
      presetGroup={
        <DatePickerPresetGroup label="Hurtigvalg" onChange={(value) => value.length}>
          <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
          <DatePickerPresetItem description="Seven days out" isCloseDialogOnDoubleClick value="week">
            In a week
          </DatePickerPresetItem>
        </DatePickerPresetGroup>
      }
    />
  );
  const _container = <DatePicker container={document.body} label="Invoice date" />;

  // @ts-expect-error no size axis
  const _noSize = <DatePicker label="Invoice date" size="md" />;
  // @ts-expect-error the preset group's label is copy, not a node
  const _noNodeLabel = <DatePickerPresetGroup label={<span>Presets</span>} />;
  // @ts-expect-error the double-click opt-in is a boolean flag, not a handler
  const _noCallbackFlag = <DatePickerPresetItem isCloseDialogOnDoubleClick={() => undefined} value="x" />;
  // @ts-expect-error container takes an element or a ref, never a selector
  const _noSelector = <DatePicker container="#overlays" label="Invoice date" />;
});

test("there is no bare date-picker entry", () => {
  // @ts-expect-error quarantined path only — never a bare date-picker entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/fuse/date-picker");
});
