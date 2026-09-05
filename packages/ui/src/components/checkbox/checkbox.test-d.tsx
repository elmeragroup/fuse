import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  Checkbox as RootCheckbox,
  CheckboxDescription as RootCheckboxDescription,
  CheckboxGroup as RootCheckboxGroup,
  CheckboxItem as RootCheckboxItem,
  CheckboxItemGroup as RootCheckboxItemGroup,
} from "@elmeragroup/ui";
import type {
  CheckboxDescriptionProps,
  CheckboxGroupProps,
  CheckboxItemProps,
} from "@elmeragroup/ui/checkbox";
import * as CheckboxModule from "@elmeragroup/ui/checkbox";
import {
  Checkbox,
  CheckboxDescription,
  CheckboxGroup,
  CheckboxItem,
  CheckboxItemGroup,
} from "@elmeragroup/ui/checkbox";
import { SelectionItem } from "@elmeragroup/ui/selection-item";

test("the public values ship from the checkbox entry and the root barrel", () => {
  expectTypeOf<typeof Checkbox>().toEqualTypeOf<typeof RootCheckbox>();
  expectTypeOf<typeof CheckboxGroup>().toEqualTypeOf<typeof RootCheckboxGroup>();
  expectTypeOf<typeof CheckboxItem>().toEqualTypeOf<typeof RootCheckboxItem>();
  expectTypeOf<typeof CheckboxItemGroup>().toEqualTypeOf<typeof RootCheckboxItemGroup>();
  expectTypeOf<typeof CheckboxDescription>().toEqualTypeOf<typeof RootCheckboxDescription>();
  expectTypeOf(Checkbox).toBeFunction();
  expectTypeOf(CheckboxGroup).toBeFunction();
  expectTypeOf(CheckboxItem).toBeFunction();
  expectTypeOf(CheckboxItemGroup).toBeFunction();
  expectTypeOf(CheckboxDescription).toBeFunction();
});

test("the entry exports only the spec names", () => {
  expectTypeOf(CheckboxModule).toHaveProperty("Checkbox");
  expectTypeOf(CheckboxModule).toHaveProperty("CheckboxGroup");
  expectTypeOf(CheckboxModule).toHaveProperty("CheckboxItem");
  expectTypeOf(CheckboxModule).toHaveProperty("CheckboxItemGroup");
  expectTypeOf(CheckboxModule).toHaveProperty("CheckboxDescription");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxItemTitle");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxItemActions");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxItemContent");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxItemDescription");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxItemSubSection");
  expectTypeOf(CheckboxModule).not.toHaveProperty("checkboxVariants");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxProps");
  expectTypeOf(CheckboxModule).not.toHaveProperty("SelectionItemGroup");
  expectTypeOf(CheckboxModule).not.toHaveProperty("CheckboxItemGroupContext");
});

test("CheckboxItem aliases are the SelectionItem part types", () => {
  expectTypeOf(CheckboxItem.Title).toEqualTypeOf(SelectionItem.Title);
  expectTypeOf(CheckboxItem.Description).toEqualTypeOf(SelectionItem.Description);
  expectTypeOf(CheckboxItem.Content).toEqualTypeOf(SelectionItem.Content);
  expectTypeOf(CheckboxItem.Actions).toEqualTypeOf(SelectionItem.Actions);
  expectTypeOf(CheckboxItem.SubSection).toEqualTypeOf(SelectionItem.SubSection);
});

test("CheckboxGroupProps is the labeled-composite face", () => {
  expectTypeOf<CheckboxGroupProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CheckboxGroupProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CheckboxGroupProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<CheckboxGroupProps["orientation"]>().toEqualTypeOf<"vertical" | "horizontal" | undefined>();
  expectTypeOf<CheckboxGroupProps["value"]>().toEqualTypeOf<string[] | undefined>();
  expectTypeOf<CheckboxGroupProps["defaultValue"]>().toEqualTypeOf<string[] | undefined>();
  expectTypeOf<CheckboxGroupProps["onChange"]>().toEqualTypeOf<((value: string[]) => void) | undefined>();
  expectTypeOf<CheckboxGroupProps["allValues"]>().toEqualTypeOf<string[] | undefined>();
  expectTypeOf<CheckboxGroupProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxGroupProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxGroupProps["name"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CheckboxGroupProps>().not.toHaveProperty("as");
  expectTypeOf<CheckboxGroupProps>().not.toHaveProperty("onValueChange");
  expectTypeOf<CheckboxGroupProps>().not.toHaveProperty("disabled");
  expectTypeOf<CheckboxGroupProps>().not.toHaveProperty("invalid");
});

test("CheckboxItemProps is the parent-vs-value discriminated union", () => {
  expectTypeOf<CheckboxItemProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxItemProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxItemProps["controlPosition"]>().toEqualTypeOf<"start" | "end" | undefined>();
  expectTypeOf<CheckboxDescriptionProps["describedBy"]>().toEqualTypeOf<string | ReactNode | undefined>();
  expectTypeOf<CheckboxItemProps>().not.toHaveProperty("as");
});

test("the elements take the spec props and reject invalid combinations", () => {
  const _primitive = <Checkbox aria-label="Accept" defaultChecked />;
  const _group = (
    <CheckboxGroup
      label="Toppings"
      description="Choose extras."
      errorMessage={<span>Required</span>}
      orientation="horizontal"
      value={["a"]}
      onChange={(value) => value.includes("a")}
      allValues={["a", "b"]}
      isDisabled
      isInvalid
      name="toppings">
      <CheckboxItem value="a">Pepperoni</CheckboxItem>
      <CheckboxItem parent>All</CheckboxItem>
    </CheckboxGroup>
  );
  const _item = (
    <CheckboxItem value="a" controlPosition="end" isDisabled isReadOnly>
      <CheckboxItem.Title>Pepperoni</CheckboxItem.Title>
      <CheckboxItem.Description>Spicy.</CheckboxItem.Description>
      <CheckboxItem.Content>Extra</CheckboxItem.Content>
      <CheckboxItem.Actions>Badge</CheckboxItem.Actions>
      <CheckboxItem.SubSection>Details</CheckboxItem.SubSection>
    </CheckboxItem>
  );
  const _itemGroup = (
    <CheckboxItemGroup label="Plans">
      <CheckboxItem value="fixed">Fixed</CheckboxItem>
    </CheckboxItemGroup>
  );
  const _note = (
    <CheckboxDescription describedBy={<span>Visual note</span>}>
      <Checkbox aria-label="Terms" />
    </CheckboxDescription>
  );

  const _needsValue = (
    // @ts-expect-error value is required unless parent
    <CheckboxItem>Missing</CheckboxItem>
  );
  const _parentWithValue = (
    // @ts-expect-error parent cannot take a value
    <CheckboxItem parent value="a">
      All
    </CheckboxItem>
  );
  const _badPosition = (
    // @ts-expect-error controlPosition is start | end only
    <CheckboxItem value="a" controlPosition="top">
      A
    </CheckboxItem>
  );
  const _badOrientation = (
    // @ts-expect-error orientation is vertical | horizontal only
    <CheckboxGroup orientation="grid" />
  );
  const _noAs = (
    // @ts-expect-error polymorphism is never an as prop
    <Checkbox as="div" />
  );
  const _nativeDisabled = (
    // @ts-expect-error native disabled is not on the composite face; use isDisabled
    <CheckboxGroup disabled />
  );
});
