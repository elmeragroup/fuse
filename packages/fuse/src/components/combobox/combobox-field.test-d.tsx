import { createRef } from "react";
import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import { Combobox, ComboboxField } from "@elmeragroup/fuse/combobox";
import type { ComboboxFieldProps } from "@elmeragroup/fuse/combobox";

type Company = { name: string; orgNumber: string };
const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

test("ComboboxFieldProps is the composite is* face, the input's props and Combobox.Root's single selection", () => {
  expectTypeOf<ComboboxFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<ComboboxFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxFieldProps["showTrigger"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxFieldProps["showClear"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<ComboboxFieldProps>().not.toHaveProperty("required");
  expectTypeOf<ComboboxFieldProps>().not.toHaveProperty("readOnly");
  expectTypeOf<ComboboxFieldProps>().not.toHaveProperty("multiple");
  expectTypeOf<ComboboxFieldProps>().not.toHaveProperty("locale");
  expectTypeOf<ComboboxFieldProps>().not.toHaveProperty("as");

  // Without items, the value props set the value type, as on SelectField.
  const _typed = (
    <ComboboxField
      id="quantity"
      label="Quantity"
      value={2}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<number | null>();
      }}
      ref={createRef<HTMLInputElement>()}>
      <Combobox.Item value={2}>Two</Combobox.Item>
    </ComboboxField>
  );
  // @ts-expect-error the ref is the input's
  const _wrongRef = <ComboboxField ref={createRef<HTMLButtonElement>()} />;
  // @ts-expect-error one selection, never an array
  const _multipleValue = <ComboboxField items={companies} value={companies} />;
});

test("items gives itemToStringValue and the value the item type through the composite, flat and grouped", () => {
  const _flat = (
    <ComboboxField
      items={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
      onValueChange={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company | null>();
      }}
    />
  );

  const groups = [{ value: "Hydro", items: companies }];
  const _grouped = (
    <ComboboxField
      items={groups}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
    />
  );

  const _inlineGroups = (
    <ComboboxField
      items={[{ value: "Hydro", items: companies }]}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
    />
  );
});

test("without items, filteredItems sets the item type, and a callback annotated to another type than items' is an error", () => {
  type Person = { fullName: string };

  const _filtered = (
    <ComboboxField
      filteredItems={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
    />
  );

  const _mismatch = (
    // @ts-expect-error the callback must take the item type of items
    <ComboboxField items={companies} itemToStringValue={(person: Person) => person.fullName} />
  );
});
