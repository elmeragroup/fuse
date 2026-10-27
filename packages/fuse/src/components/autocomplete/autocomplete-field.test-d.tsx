import { createRef } from "react";
import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import { Autocomplete, AutocompleteField } from "@elmeragroup/fuse/autocomplete";
import type { AutocompleteFieldProps } from "@elmeragroup/fuse/autocomplete";

type Company = { name: string; orgNumber: string };
const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

test("AutocompleteFieldProps is the composite is* face, the input's props and Autocomplete.Root's text value", () => {
  expectTypeOf<AutocompleteFieldProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<AutocompleteFieldProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<AutocompleteFieldProps["status"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<AutocompleteFieldProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<AutocompleteFieldProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<AutocompleteFieldProps["showTrigger"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<AutocompleteFieldProps["showClear"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<AutocompleteFieldProps>().not.toHaveProperty("disabled");
  expectTypeOf<AutocompleteFieldProps>().not.toHaveProperty("required");
  expectTypeOf<AutocompleteFieldProps>().not.toHaveProperty("readOnly");
  expectTypeOf<AutocompleteFieldProps>().not.toHaveProperty("inline");
  expectTypeOf<AutocompleteFieldProps>().not.toHaveProperty("locale");
  expectTypeOf<AutocompleteFieldProps>().not.toHaveProperty("as");

  // Root's props pass through, and the value is the text.
  const _field = (
    <AutocompleteField
      id="company"
      label="Company"
      name="company"
      filter={null}
      value="Fjell"
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<string>();
      }}
      ref={createRef<HTMLInputElement>()}>
      <Autocomplete.Empty />
    </AutocompleteField>
  );
  // @ts-expect-error the ref is the input's
  const _wrongRef = <AutocompleteField ref={createRef<HTMLButtonElement>()} />;
  // @ts-expect-error the value is the text, never the item
  const _itemValue = <AutocompleteField items={companies} value={companies[0]} />;
});

test("items gives itemToStringValue the item type through the composite, flat and grouped", () => {
  const _flat = (
    <AutocompleteField
      items={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );

  const groups = [{ value: "Hydro", items: companies }];
  const _grouped = (
    <AutocompleteField
      items={groups}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );

  const _inlineGroups = (
    <AutocompleteField
      items={[{ value: "Hydro", items: companies }]}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );
});

test("without items, filteredItems sets the item type, and a callback annotated to another type than items' is an error", () => {
  type Person = { fullName: string };

  const _filtered = (
    <AutocompleteField
      filteredItems={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );

  const _mismatch = (
    // @ts-expect-error the callback must take the item type of items
    <AutocompleteField items={companies} itemToStringValue={(person: Person) => person.fullName} />
  );
});
