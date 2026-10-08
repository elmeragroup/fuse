import type { ComponentProps, ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  CheckboxDescriptionProps,
  CheckboxGroupProps,
  CheckboxItemProps,
} from "@elmeragroup/fuse/checkbox";
import {
  Checkbox,
  CheckboxDescription,
  CheckboxGroup,
  CheckboxItem,
  CheckboxItemGroup,
} from "@elmeragroup/fuse/checkbox";

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

test("CheckboxItemProps is the parent-vs-value discriminated union and the elements reject invalid combinations", () => {
  expectTypeOf<CheckboxItemProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxItemProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxItemProps["controlPosition"]>().toEqualTypeOf<"start" | "end" | undefined>();
  expectTypeOf<CheckboxDescriptionProps["describedBy"]>().toEqualTypeOf<string | ReactNode | undefined>();
  expectTypeOf<CheckboxItemProps>().not.toHaveProperty("as");
  // The row forwards its Field.Item root's attributes and keeps the shell wiring and `disabled`.
  expectTypeOf<CheckboxItemProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CheckboxItemProps>().toHaveProperty("style");
  expectTypeOf<CheckboxItemProps>().toHaveProperty("onClick");
  expectTypeOf<CheckboxItemProps>().toHaveProperty("render");
  expectTypeOf<CheckboxItemProps>().not.toHaveProperty("disabled");
  expectTypeOf<CheckboxItemProps>().not.toHaveProperty("dataSlot");
  expectTypeOf<CheckboxItemProps>().not.toHaveProperty("control");
  expectTypeOf<CheckboxItemProps>().not.toHaveProperty("subSections");

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

test("CheckboxGroup and CheckboxItemGroup accept isLabelHidden as an optional boolean", () => {
  expectTypeOf<ComponentProps<typeof CheckboxGroup>["isLabelHidden"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ComponentProps<typeof CheckboxItemGroup>["isLabelHidden"]>().toEqualTypeOf<
    boolean | undefined
  >();
});
