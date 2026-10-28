import type { RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  ComboboxChipProps,
  ComboboxClearProps,
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxRootProps,
} from "@elmeragroup/fuse/combobox";
import * as ComboboxModule from "@elmeragroup/fuse/combobox";
import { Combobox, useComboboxAnchor } from "@elmeragroup/fuse/combobox";

test("Portal, Positioner and Popup stay off the public namespace, Input, Content, Chip and Clear take the public extra props, and Root omits locale", () => {
  expectTypeOf(Combobox).not.toHaveProperty("Portal");
  expectTypeOf(Combobox).not.toHaveProperty("Positioner");
  expectTypeOf(Combobox).not.toHaveProperty("Popup");
  expectTypeOf(ComboboxModule).not.toHaveProperty("comboboxVariants");
  expectTypeOf(ComboboxModule).not.toHaveProperty("ComboboxInput");
  expectTypeOf(ComboboxModule).not.toHaveProperty("ComboboxClear");

  expectTypeOf<ComboboxInputProps["showTrigger"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxInputProps["showClear"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxInputProps["clearLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxClearProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxChipProps["showRemove"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComboboxChipProps["removeLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ComboboxContentProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();
  expectTypeOf<ComboboxContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<ComboboxRootProps>().not.toHaveProperty("locale");

  const _tree = (
    <Combobox.Root items={["apple"]}>
      <Combobox.Input placeholder="Search…" showTrigger showClear clearLabel="Wipe">
        <input type="hidden" name="fruit" />
      </Combobox.Input>
      <Combobox.Content side="bottom" align="start" sideOffset={6} alignOffset={0}>
        <Combobox.Empty>Nothing.</Combobox.Empty>
        <Combobox.List>
          <Combobox.Collection>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.Collection>
        </Combobox.List>
        <Combobox.Separator />
      </Combobox.Content>
    </Combobox.Root>
  );

  const _chips = (
    <Combobox.Root multiple>
      <Combobox.Chips>
        <Combobox.Chip showRemove removeLabel="Drop">
          Apple
        </Combobox.Chip>
        <Combobox.ChipsInput />
      </Combobox.Chips>
      <Combobox.Clear label="Wipe" />
      <Combobox.Value />
      <Combobox.Trigger />
    </Combobox.Root>
  );

  const _anchor: RefObject<HTMLDivElement | null> = useComboboxAnchor();
  const _anchored = <Combobox.Content anchor={_anchor} />;

  // @ts-expect-error locale is provider-only
  const _noLocale = <Combobox.Root locale="nb-NO" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Combobox.Input as="div" />;
});

test("items give the value and the callbacks the item type, with one selection or with multiple", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _single = (
    <Combobox.Root
      items={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Company | null>();
      }}
    />
  );

  const _multiple = (
    <Combobox.Root
      items={companies}
      multiple
      value={companies}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<Company[]>();
      }}
    />
  );

  // @ts-expect-error multiple value is array-shaped
  const _scalarWhenMultiple = <Combobox.Root items={companies} multiple value={companies[0]} />;
});

test("with grouped items, the value and the callbacks take one item of a group, not the group", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const groups = [{ value: "Hydro", items: companies }];
  const _grouped = (
    <Combobox.Root
      items={groups}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
    />
  );

  const _inlineGroups = (
    <Combobox.Root
      items={[{ value: "Hydro", items: companies }]}
      onValueChange={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company | null>();
      }}
    />
  );
});

test("without items, filteredItems or the value props set the value type", () => {
  type Company = { name: string; orgNumber: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _filtered = (
    <Combobox.Root
      filteredItems={companies}
      itemToStringValue={(company) => {
        expectTypeOf(company).toEqualTypeOf<Company>();
        return company.orgNumber;
      }}
    />
  );

  const _valued = (
    <Combobox.Root
      defaultValue={2}
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<number | null>();
      }}
    />
  );
});

test("items decide the value type, so a callback annotated to another type is an error", () => {
  type Company = { name: string; orgNumber: string };
  type Person = { fullName: string };
  const companies: Company[] = [{ name: "Fjellkraft AS", orgNumber: "998877665" }];

  const _mismatch = (
    // @ts-expect-error the callback must take the item type of items
    <Combobox.Root items={companies} itemToStringValue={(person: Person) => person.fullName} />
  );
});
