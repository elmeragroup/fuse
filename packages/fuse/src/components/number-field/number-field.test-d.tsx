import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { NumberFieldProps } from "@elmeragroup/fuse/number-field";

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
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("readOnly");
  expectTypeOf<NumberFieldProps>().not.toHaveProperty("required");
});
