import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { TextFieldProps } from "@elmeragroup/fuse/text-field";

test("TextFieldProps is the composite is* face plus remaining native input props", () => {
  expectTypeOf<TextFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<TextFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<TextFieldProps["onChange"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<TextFieldProps["defaultValue"]>().toEqualTypeOf<string | null | undefined>();
  expectTypeOf<TextFieldProps["filter"]>().toEqualTypeOf<"numeric" | undefined>();
  expectTypeOf<TextFieldProps["variant"]>().toEqualTypeOf<"card" | "inline" | undefined>();
  expectTypeOf<TextFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextFieldProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextFieldProps["isPending"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextFieldProps["isSuccess"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextFieldProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<TextFieldProps>().toHaveProperty("type");
  expectTypeOf<TextFieldProps>().toHaveProperty("inputMode");
  expectTypeOf<TextFieldProps>().toHaveProperty("maxLength");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("as");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("isIconActive");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("readOnly");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("required");
});
