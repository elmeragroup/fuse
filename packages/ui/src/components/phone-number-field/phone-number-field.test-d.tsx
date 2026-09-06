import type { ReactNode, RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type { PhoneNumberField as RootPhoneNumberField } from "@elmeragroup/ui";
import type { PhoneNumberFieldProps } from "@elmeragroup/ui/phone-number-field";
import * as PhoneNumberFieldModule from "@elmeragroup/ui/phone-number-field";
import { PhoneNumberField } from "@elmeragroup/ui/phone-number-field";

test("PhoneNumberField ships from the phone-number-field entry and the root barrel", () => {
  expectTypeOf<typeof PhoneNumberField>().toEqualTypeOf<typeof RootPhoneNumberField>();
  expectTypeOf(PhoneNumberField).toBeFunction();
});

test("the public module exports only PhoneNumberField and its props type", () => {
  expectTypeOf(PhoneNumberFieldModule).not.toHaveProperty("Flag");
  expectTypeOf(PhoneNumberFieldModule).not.toHaveProperty("usePhoneNumberFieldState");
  expectTypeOf(PhoneNumberFieldModule).not.toHaveProperty("phoneNumberFieldVariants");
  expectTypeOf(PhoneNumberFieldModule).not.toHaveProperty("getCountries");
});

test("PhoneNumberFieldProps is the closed composite face", () => {
  expectTypeOf<PhoneNumberFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PhoneNumberFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<PhoneNumberFieldProps["onChange"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<PhoneNumberFieldProps["value"]>().toEqualTypeOf<string | undefined>();
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
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("name");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("className");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("aria-label");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("autoFocus");
  expectTypeOf<PhoneNumberFieldProps>().toHaveProperty("id");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("locale");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("size");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("as");
  expectTypeOf<PhoneNumberFieldProps>().not.toHaveProperty("variant");
});

test("the element takes the public props and rejects unresolved flag codes as defaultCountryCode", () => {
  const _basic = <PhoneNumberField label="Mobile" defaultCountryCode="NO" />;
  const _nordic = (
    <>
      <PhoneNumberField defaultCountryCode="SE" />
      <PhoneNumberField defaultCountryCode="FI" />
    </>
  );
  const _states = (
    <PhoneNumberField
      label="Mobile"
      isDisabled
      isInvalid
      isReadOnly
      isRequired
      errorMessage={<span>Required</span>}
      international
      formatOnType
      preserveOnCountryChange
      outputFormat="international"
      selectCountryLabel="Country"
      searchCountriesLabel="Find"
      noCountriesFoundText="None."
      onChange={(value) => value.toUpperCase()}
    />
  );
  const _labelLess = <PhoneNumberField aria-label="Phone" autoFocus id="phone" name="phone" />;
  const container: RefObject<HTMLElement | null> = { current: null };
  const _container = <PhoneNumberField container={container} />;

  // @ts-expect-error AC has no packaged flag asset
  const _ac = <PhoneNumberField defaultCountryCode="AC" />;
  // @ts-expect-error BQ has no packaged flag asset
  const _bq = <PhoneNumberField defaultCountryCode="BQ" />;
  // @ts-expect-error EH has no packaged flag asset
  const _eh = <PhoneNumberField defaultCountryCode="EH" />;
  // @ts-expect-error TA has no packaged flag asset
  const _ta = <PhoneNumberField defaultCountryCode="TA" />;
  // @ts-expect-error locale is provider-only
  const _noLocale = <PhoneNumberField locale="nb-NO" />;
  // @ts-expect-error no size axis
  const _noSize = <PhoneNumberField size="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <PhoneNumberField as="div" />;
  // @ts-expect-error native disabled is not on the composite face; use isDisabled
  const _noDisabled = <PhoneNumberField disabled />;
  // @ts-expect-error native readOnly is not on the composite face; use isReadOnly
  const _noReadOnly = <PhoneNumberField readOnly />;
});
