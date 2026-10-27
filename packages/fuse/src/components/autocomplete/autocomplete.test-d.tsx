import { expectTypeOf, test } from "vitest";

import type {
  AutocompleteClearProps,
  AutocompleteContentProps,
  AutocompleteInputProps,
  AutocompleteRootProps,
} from "@elmeragroup/fuse/autocomplete";
import * as AutocompleteModule from "@elmeragroup/fuse/autocomplete";
import { Autocomplete } from "@elmeragroup/fuse/autocomplete";

test("Portal, Positioner and Popup stay off the public namespace, the parts take their extra props, and Root omits locale", () => {
  expectTypeOf(Autocomplete).not.toHaveProperty("Portal");
  expectTypeOf(Autocomplete).not.toHaveProperty("Positioner");
  expectTypeOf(Autocomplete).not.toHaveProperty("Popup");
  expectTypeOf(Autocomplete).not.toHaveProperty("InputGroup");
  expectTypeOf(AutocompleteModule).not.toHaveProperty("autocompleteVariants");
  expectTypeOf(AutocompleteModule).not.toHaveProperty("AutocompleteInput");

  expectTypeOf<AutocompleteInputProps["showTrigger"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<AutocompleteInputProps["showClear"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<AutocompleteInputProps["triggerLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<AutocompleteInputProps["clearLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<AutocompleteClearProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<AutocompleteContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<AutocompleteRootProps>().not.toHaveProperty("locale");

  const _tree = (
    <Autocomplete.Root items={["Apple"]} name="fruit" defaultValue="Ap">
      <Autocomplete.Input placeholder="Type a fruit…" showTrigger showClear clearLabel="Wipe" />
      <Autocomplete.Status>1 result</Autocomplete.Status>
      <Autocomplete.Content side="bottom" align="start" sideOffset={6} alignOffset={0}>
        <Autocomplete.Empty>Nothing.</Autocomplete.Empty>
        <Autocomplete.List>
          <Autocomplete.Group items={["Apple"]}>
            <Autocomplete.Label>Fruit</Autocomplete.Label>
            <Autocomplete.Collection>
              {(item: string) => (
                <Autocomplete.Item key={item} value={item}>
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.Collection>
          </Autocomplete.Group>
          <Autocomplete.Separator />
        </Autocomplete.List>
      </Autocomplete.Content>
      <Autocomplete.Trigger />
      <Autocomplete.Clear label="Wipe" />
    </Autocomplete.Root>
  );

  // @ts-expect-error locale is provider-only
  const _noLocale = <Autocomplete.Root locale="nb-NO" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Autocomplete.Input as="div" />;
});

test("Root's value is the text, and itemToStringValue receives the item type of items", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _root = (
    <Autocomplete.Root
      items={companies}
      value="Fjell"
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<string>();
      }}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );

  // @ts-expect-error the value is the text, never the item
  const _itemValue = <Autocomplete.Root items={companies} value={companies[0]} />;
});

test("with grouped items, itemToStringValue receives one item of a group, not the group", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const groups = [{ value: "Hydro", items: companies }];

  const _root = (
    <Autocomplete.Root
      items={groups}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );
});

test("an inline grouped literal still gives itemToStringValue one item of a group", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _root = (
    <Autocomplete.Root
      items={[{ value: "Hydro", items: companies }]}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );
});

test("without items, the other props that name the item set the type itemToStringValue receives", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _annotated = <Autocomplete.Root itemToStringValue={(company: Company) => company.name} />;

  const _filtered = (
    <Autocomplete.Root
      filteredItems={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );
});

test("items decide the item type, so a callback annotated to another type is an error", () => {
  type Company = { name: string; orgNumber: string };
  type Person = { fullName: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _mismatch = (
    // @ts-expect-error the callback must take the item type of items
    <Autocomplete.Root items={companies} itemToStringValue={(person: Person) => person.fullName} />
  );
});

test("with grouped items and grouped filteredItems, itemToStringValue receives one item of a group", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const groups = [{ value: "Hydro", items: companies }];

  const _root = (
    <Autocomplete.Root
      items={groups}
      filteredItems={groups}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );
});

test("an empty filteredItems leaves the item type to items", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _root = (
    <Autocomplete.Root
      items={companies}
      filteredItems={[]}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.name;
      }}
    />
  );
});
