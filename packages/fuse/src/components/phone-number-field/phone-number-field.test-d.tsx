import type { ReactNode, RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type { PhoneNumberFieldProps } from "@elmeragroup/fuse/phone-number-field";

test("PhoneNumberFieldProps is the closed composite face", () => {
  expectTypeOf<PhoneNumberFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<PhoneNumberFieldProps["onChange"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<PhoneNumberFieldProps["value"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["defaultValue"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["outputFormat"]>().toEqualTypeOf<
    "e164" | "international" | "national" | "raw" | undefined
  >();
  expectTypeOf<PhoneNumberFieldProps["international"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["autoDetectCountry"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["preserveOnCountryChange"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["formatOnType"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PhoneNumberFieldProps["selectCountryLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["searchCountriesLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["noCountriesFoundText"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["container"]>().toEqualTypeOf<
    HTMLElement | RefObject<HTMLElement | null> | undefined
  >();
  expectTypeOf<PhoneNumberFieldProps["aria-required"]>().toEqualTypeOf<
    boolean | "true" | "false" | undefined
  >();
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("name");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("className");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("aria-label");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("autoFocus");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("id");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("locale");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("size");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("as");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("variant");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("readOnly");
  type DefaultCountryCode = NonNullable<PhoneNumberFieldProps["defaultCountryCode"]>;
  // The picker list takes the same codes as the default country.
  expectTypeOf<NonNullable<PhoneNumberFieldProps["countries"]>>().toEqualTypeOf<
    readonly DefaultCountryCode[]
  >();
  expectTypeOf<"NO" | "SE" | "FI">().toExtend<DefaultCountryCode>();
  // AC, BQ, EH and TA have no packaged flag asset.
  expectTypeOf<"AC">().not.toExtend<DefaultCountryCode>();
  expectTypeOf<"BQ">().not.toExtend<DefaultCountryCode>();
  expectTypeOf<"EH">().not.toExtend<DefaultCountryCode>();
  expectTypeOf<"TA">().not.toExtend<DefaultCountryCode>();
});
