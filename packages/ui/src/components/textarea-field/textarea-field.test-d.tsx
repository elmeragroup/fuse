import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { TextareaField as RootTextareaField } from "@elmeragroup/ui";
import type { TextareaFieldProps } from "@elmeragroup/ui/textarea-field";
import * as TextareaFieldEntry from "@elmeragroup/ui/textarea-field";
import { TextareaField } from "@elmeragroup/ui/textarea-field";

test("TextareaField ships from the textarea-field entry and the root barrel", () => {
  expectTypeOf<typeof TextareaField>().toEqualTypeOf<typeof RootTextareaField>();
  expectTypeOf(TextareaField).toBeFunction();
  expectTypeOf(TextareaFieldEntry).not.toHaveProperty("TextArea");
});

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
  expectTypeOf<TextareaFieldProps>().not.toHaveProperty("as");
  expectTypeOf<TextareaFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<TextareaFieldProps>().not.toHaveProperty("required");
});

test("the element takes the spec's props and no TextArea alias or native is* duplicates", () => {
  const _basic = <TextareaField label="Bio" description="Shown to other users." placeholder="Write a bio." />;
  const _states = (
    <TextareaField
      label="Notes"
      isDisabled
      isInvalid
      isRequired
      maxLength={120}
      errorMessage={<span>Required</span>}
      onChange={(next: string) => next.toUpperCase()}
    />
  );
  const _uncontrolled = <TextareaField defaultValue="Started here." />;
  const _readOnly = <TextareaField label="Locked" readOnly defaultValue="Stay" />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <TextareaField as="div" />;
  // @ts-expect-error native disabled is not on the composite face; use isDisabled
  const _noDisabled = <TextareaField disabled />;
  // @ts-expect-error native required is not on the composite face; use isRequired
  const _noRequired = <TextareaField required />;
});
