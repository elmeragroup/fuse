import { createRef } from "react";
import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";
import type { SelectFieldProps } from "@elmeragroup/fuse/select-field";

test("SelectFieldProps is the composite is* face, Select.Root's value props and the trigger's props", () => {
  expectTypeOf<SelectFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SelectFieldProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SelectFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<SelectFieldProps["placeholder"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<SelectFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SelectFieldProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SelectFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SelectFieldProps["name"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SelectFieldProps<number>["value"]>().toEqualTypeOf<number | null | undefined>();
  expectTypeOf<SelectFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<SelectFieldProps>().not.toHaveProperty("required");
  expectTypeOf<SelectFieldProps>().not.toHaveProperty("multiple");
  expectTypeOf<SelectFieldProps>().not.toHaveProperty("readOnly");
  expectTypeOf<SelectFieldProps>().not.toHaveProperty("as");

  // The Value generic follows the value props, and onValueChange receives it or null.
  const _typed = (
    <SelectField
      value={2}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<number | null>();
      }}>
      <Select.Item value={2}>Two</Select.Item>
    </SelectField>
  );
  // @ts-expect-error a number field takes no string value
  const _mismatch = <SelectField<number> value="2" />;

  // The ref and the remaining props go to the trigger button.
  const _trigger = <SelectField ref={createRef<HTMLButtonElement>()} size="sm" data-testid="plan" />;
  // @ts-expect-error the ref is the trigger button's
  const _wrongRef = <SelectField ref={createRef<HTMLInputElement>()} />;
});
