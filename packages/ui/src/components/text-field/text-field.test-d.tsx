import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { TextField as RootTextField } from "@elmeragroup/ui";
import type { TextFieldProps } from "@elmeragroup/ui/text-field";
import { TextField, textFieldVariants } from "@elmeragroup/ui/text-field";

test("TextField ships from the text-field entry and the root barrel", () => {
  expectTypeOf<typeof TextField>().toEqualTypeOf<typeof RootTextField>();
  expectTypeOf(TextField).toBeFunction();
});

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
  expectTypeOf<TextFieldProps>().toHaveProperty("type");
  expectTypeOf<TextFieldProps>().toHaveProperty("inputMode");
  expectTypeOf<TextFieldProps>().toHaveProperty("maxLength");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("as");
  expectTypeOf<TextFieldProps>().not.toHaveProperty("isIconActive");
});

test("textFieldVariants is public and slotted", () => {
  expectTypeOf(textFieldVariants).toBeFunction();
  expectTypeOf(textFieldVariants().base()).toBeString();
  expectTypeOf(textFieldVariants({ variant: "card" }).fieldGroup()).toBeString();
  expectTypeOf(
    textFieldVariants({ variant: "inline", hidden: true, isIconActive: true }).input()
  ).toBeString();
  expectTypeOf(textFieldVariants()).not.toHaveProperty("textArea");
});

test("the element takes the spec's props and no polymorphic as prop", () => {
  const _basic = <TextField label="Email" description="Work address." placeholder="name@example.com" />;
  const _states = (
    <TextField
      label="Code"
      isDisabled
      isInvalid
      isPending
      isSuccess
      isReadOnly
      isRequired
      errorMessage={<span>Required</span>}
      filter="numeric"
      variant="card"
      onChange={(value) => value.toUpperCase()}
    />
  );
  const _nullDefault = <TextField defaultValue={null} />;

  // @ts-expect-error filter is digits-only, not a free-form string
  const _badFilter = <TextField filter="alpha" />;
  // @ts-expect-error outline is not a text-field variant
  const _badVariant = <TextField variant="outline" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <TextField as="div" />;
  // @ts-expect-error native disabled is not on the composite face; use isDisabled
  const _noDisabled = <TextField disabled />;
  // @ts-expect-error native readOnly is not on the composite face; use isReadOnly
  const _noReadOnly = <TextField readOnly />;
  // @ts-expect-error native required is not on the composite face; use isRequired
  const _noRequired = <TextField required />;
});
