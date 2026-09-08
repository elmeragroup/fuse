import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { NumberField as RootNumberField } from "@elmeragroup/ui";
import type { NumberFieldProps } from "@elmeragroup/ui/number-field";
import { NumberField } from "@elmeragroup/ui/number-field";

test("NumberField ships from the number-field entry and the root barrel", () => {
  expectTypeOf<typeof NumberField>().toEqualTypeOf<typeof RootNumberField>();
  expectTypeOf(NumberField).toBeFunction();
});

test("NumberFieldProps is the closed composite face", () => {
  expectTypeOf<NumberFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<NumberFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<NumberFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<NumberFieldProps["onChange"]>().toEqualTypeOf<((value: number) => void) | undefined>();
  expectTypeOf<NumberFieldProps["value"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<NumberFieldProps["defaultValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<NumberFieldProps["minValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<NumberFieldProps["maxValue"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<NumberFieldProps["step"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<NumberFieldProps["formatOptions"]>().toEqualTypeOf<Intl.NumberFormatOptions | undefined>();
  expectTypeOf<NumberFieldProps["denomination"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<NumberFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NumberFieldProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NumberFieldProps["isPending"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NumberFieldProps["isSuccess"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NumberFieldProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NumberFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NumberFieldProps>().toHaveProperty("name");
  expectTypeOf<NumberFieldProps>().toHaveProperty("className");
  expectTypeOf<NumberFieldProps>().toHaveProperty("aria-label");
  expectTypeOf<NumberFieldProps["increaseLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<NumberFieldProps["decreaseLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<NumberFieldProps>().toHaveProperty("autoFocus");
  expectTypeOf<NumberFieldProps>().toHaveProperty("id");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("locale");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("size");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("as");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("format");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("min");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("max");
});

test("the element takes the public props and no primitive or locale aliases", () => {
  const _basic = (
    <NumberField label="Quantity" description="Whole packs." minValue={0} maxValue={10} step={1} />
  );
  const _states = (
    <NumberField
      label="Amount"
      isDisabled
      isInvalid
      isPending
      isSuccess
      isReadOnly
      isRequired
      errorMessage={<span>Required</span>}
      denomination="kr"
      formatOptions={{ style: "currency", currency: "NOK" }}
      onChange={(value) => value + 1}
    />
  );
  const _labelLess = <NumberField aria-label="Count" autoFocus id="count" name="count" />;
  const _stepperLabels = <NumberField label="Quantity" increaseLabel="Add one" decreaseLabel="Remove one" />;

  // @ts-expect-error stepper labels are strings
  const _noNumericIncrease = <NumberField increaseLabel={1} />;
  // @ts-expect-error stepper labels are strings
  const _noNumericDecrease = <NumberField decreaseLabel={1} />;
  // @ts-expect-error locale is provider-only
  const _noLocale = <NumberField locale="nb-NO" />;
  // @ts-expect-error no size axis
  const _noSize = <NumberField size="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <NumberField as="div" />;
  // @ts-expect-error native disabled is not on the composite face; use isDisabled
  const _noDisabled = <NumberField disabled />;
  // @ts-expect-error native readOnly is not on the composite face; use isReadOnly
  const _noReadOnly = <NumberField readOnly />;
  // @ts-expect-error native required is not on the composite face; use isRequired
  const _noRequired = <NumberField required />;
  // @ts-expect-error base-ui format is formatOptions on the composite
  const _noFormat = <NumberField format={{ style: "percent" }} />;
});
