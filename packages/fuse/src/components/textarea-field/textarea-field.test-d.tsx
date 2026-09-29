import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { TextareaFieldProps } from "@elmeragroup/fuse/textarea-field";

test("TextareaFieldProps is the composite is* face plus remaining native textarea props", () => {
  expectTypeOf<TextareaFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextareaFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextareaFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<TextareaFieldProps["onChange"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<TextareaFieldProps["value"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextareaFieldProps["defaultValue"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextareaFieldProps["maxLength"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<TextareaFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextareaFieldProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextareaFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextareaFieldProps>().toHaveProperty("placeholder");
  expectTypeOf<TextareaFieldProps>().toHaveProperty("name");
  expectTypeOf<TextareaFieldProps>().toHaveProperty("rows");
  expectTypeOf<TextareaFieldProps>().toHaveProperty("readOnly");
  expectTypeOf<TextareaFieldProps>().toHaveProperty("className");
  expectTypeOf<TextareaFieldProps["textareaClassName"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextareaFieldProps>().not.toHaveProperty("as");
  expectTypeOf<TextareaFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<TextareaFieldProps>().not.toHaveProperty("required");
});
