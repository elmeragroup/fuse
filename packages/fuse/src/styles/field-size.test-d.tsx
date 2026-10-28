import { expectTypeOf, test } from "vitest";

import type { AutocompleteInputProps } from "@elmeragroup/fuse/autocomplete";
import type { ComboboxChipsProps, ComboboxInputProps } from "@elmeragroup/fuse/combobox";
import type { InputProps } from "@elmeragroup/fuse/input";
import type { InputGroupInputProps, InputGroupRootProps } from "@elmeragroup/fuse/input-group";
import type { NumberFieldProps } from "@elmeragroup/fuse/number-field";
import type { PhoneNumberFieldProps } from "@elmeragroup/fuse/phone-number-field";
import type { DateFieldProps, DateInputProps } from "@elmeragroup/fuse/react-aria/date-field";
import type { DatePickerProps } from "@elmeragroup/fuse/react-aria/date-picker";
import type { DateRangePickerProps } from "@elmeragroup/fuse/react-aria/date-range-picker";
import type { SearchFieldProps } from "@elmeragroup/fuse/react-aria/search-field";
import type { SelectTriggerProps } from "@elmeragroup/fuse/select";
import type { SelectFieldProps } from "@elmeragroup/fuse/select-field";
import type { TextFieldProps } from "@elmeragroup/fuse/text-field";
import type { TextareaProps } from "@elmeragroup/fuse/textarea";
import type { TextareaFieldProps } from "@elmeragroup/fuse/textarea-field";

/** The field size every text-entry field box takes, spelled as Select's trigger spells it. */
type FieldSize = "sm" | "default" | undefined;

test("every text-entry field box takes the field size", () => {
  expectTypeOf<InputProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<TextareaProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<TextFieldProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<TextareaFieldProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<SelectFieldProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<NumberFieldProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<PhoneNumberFieldProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<SearchFieldProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<DateFieldProps<never>["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<DateInputProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<DatePickerProps<never>["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<DateRangePickerProps<never>["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<InputGroupRootProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<ComboboxInputProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<ComboboxChipsProps["size"]>().toEqualTypeOf<FieldSize>();
  expectTypeOf<AutocompleteInputProps["size"]>().toEqualTypeOf<FieldSize>();
  // The model the fields copy.
  expectTypeOf<SelectTriggerProps["size"]>().toEqualTypeOf<FieldSize>();
});

test("the group's input is no field box, so it keeps the native numeric size attribute", () => {
  expectTypeOf<InputGroupInputProps["size"]>().toEqualTypeOf<number | undefined>();
});
