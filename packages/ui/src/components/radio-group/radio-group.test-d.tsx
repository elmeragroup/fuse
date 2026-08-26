import type { ComponentProps, ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  Radio as RootRadio,
  RadioGroup as RootRadioGroup,
  RadioGroupItem as RootRadioGroupItem,
  RadioIconButton as RootRadioIconButton,
  RadioItem as RootRadioItem,
  RadioItemGroup as RootRadioItemGroup,
} from "@elmeragroup/ui";
import type {
  RadioGroupProps,
  RadioIconButtonProps,
  RadioItemProps,
  RadioProps,
} from "@elmeragroup/ui/radio-group";
import * as RadioGroupModule from "@elmeragroup/ui/radio-group";
import {
  Radio,
  RadioGroup,
  RadioGroupItem,
  RadioIconButton,
  RadioItem,
  RadioItemGroup,
} from "@elmeragroup/ui/radio-group";
import { SelectionItem } from "@elmeragroup/ui/selection-item";

test("the public values ship from the radio-group entry and the root barrel", () => {
  expectTypeOf<typeof Radio>().toEqualTypeOf<typeof RootRadio>();
  expectTypeOf<typeof RadioGroup>().toEqualTypeOf<typeof RootRadioGroup>();
  expectTypeOf<typeof RadioGroupItem>().toEqualTypeOf<typeof RootRadioGroupItem>();
  expectTypeOf<typeof RadioIconButton>().toEqualTypeOf<typeof RootRadioIconButton>();
  expectTypeOf<typeof RadioItem>().toEqualTypeOf<typeof RootRadioItem>();
  expectTypeOf<typeof RadioItemGroup>().toEqualTypeOf<typeof RootRadioItemGroup>();
  expectTypeOf(Radio).toBeFunction();
  expectTypeOf(RadioGroup).toBeFunction();
  expectTypeOf(RadioGroupItem).toBeFunction();
  expectTypeOf(RadioIconButton).toBeFunction();
  expectTypeOf(RadioItem).toBeFunction();
  expectTypeOf(RadioItemGroup).toBeFunction();
});

test("the entry exports only the spec names", () => {
  expectTypeOf(RadioGroupModule).toHaveProperty("Radio");
  expectTypeOf(RadioGroupModule).toHaveProperty("RadioGroup");
  expectTypeOf(RadioGroupModule).toHaveProperty("RadioGroupItem");
  expectTypeOf(RadioGroupModule).toHaveProperty("RadioIconButton");
  expectTypeOf(RadioGroupModule).toHaveProperty("RadioItem");
  expectTypeOf(RadioGroupModule).toHaveProperty("RadioItemGroup");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("RadioItemTitle");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("RadioItemActions");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("RadioItemContent");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("RadioItemDescription");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("RadioItemSubSection");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("radioGroupVariants");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("iconButtonSizes");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("SelectionItemGroup");
  expectTypeOf(RadioGroupModule).not.toHaveProperty("RadioItemGroupContext");
});

test("RadioItem aliases are the SelectionItem part types", () => {
  expectTypeOf(RadioItem.Title).toEqualTypeOf(SelectionItem.Title);
  expectTypeOf(RadioItem.Description).toEqualTypeOf(SelectionItem.Description);
  expectTypeOf(RadioItem.Content).toEqualTypeOf(SelectionItem.Content);
  expectTypeOf(RadioItem.Actions).toEqualTypeOf(SelectionItem.Actions);
  expectTypeOf(RadioItem.SubSection).toEqualTypeOf(SelectionItem.SubSection);
});

test("RadioGroupProps is the labeled-composite face including null", () => {
  expectTypeOf<RadioGroupProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<RadioGroupProps["description"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<RadioGroupProps["errorMessage"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<RadioGroupProps["isPending"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioGroupProps["orientation"]>().toEqualTypeOf<"vertical" | "horizontal" | undefined>();
  expectTypeOf<RadioGroupProps["value"]>().toEqualTypeOf<string | null | undefined>();
  expectTypeOf<RadioGroupProps["defaultValue"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<RadioGroupProps["onChange"]>().toEqualTypeOf<((value: string) => void) | undefined>();
  expectTypeOf<RadioGroupProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioGroupProps["isInvalid"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioGroupProps["isReadOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioGroupProps["isRequired"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioGroupProps["name"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<RadioGroupProps>().not.toHaveProperty("as");
  expectTypeOf<RadioGroupProps>().not.toHaveProperty("onValueChange");
  expectTypeOf<RadioGroupProps>().not.toHaveProperty("disabled");
  expectTypeOf<RadioGroupProps>().not.toHaveProperty("invalid");
});

test("RadioGroupItem keeps Base UI's stateful className callback", () => {
  type ItemClassName = ComponentProps<typeof RadioGroupItem>["className"];
  expectTypeOf<ItemClassName>().not.toEqualTypeOf<string | undefined>();
  expectTypeOf<Extract<NonNullable<ItemClassName>, string>>().toEqualTypeOf<string>();
  type ItemClassNameFn = Exclude<NonNullable<ItemClassName>, string>;
  expectTypeOf<ItemClassNameFn>().parameter(0).toHaveProperty("checked");
});

test("Radio, RadioItem, and RadioIconButton props match the spec axes", () => {
  expectTypeOf<RadioProps["value"]>().toEqualTypeOf<string>();
  expectTypeOf<RadioProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioItemProps["value"]>().toEqualTypeOf<string>();
  expectTypeOf<RadioItemProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioItemProps["controlPosition"]>().toEqualTypeOf<"start" | "end" | undefined>();
  expectTypeOf<RadioIconButtonProps["value"]>().toEqualTypeOf<string>();
  expectTypeOf<RadioIconButtonProps["aria-label"]>().toEqualTypeOf<string>();
  expectTypeOf<RadioIconButtonProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<RadioIconButtonProps["size"]>().toEqualTypeOf<
    "icon" | "icon-xxs" | "icon-xs" | "icon-sm" | "icon-lg" | undefined
  >();
  expectTypeOf<RadioProps>().not.toHaveProperty("as");
  expectTypeOf<RadioItemProps>().not.toHaveProperty("as");
  expectTypeOf<RadioIconButtonProps>().not.toHaveProperty("as");
  expectTypeOf<RadioIconButtonProps>().not.toHaveProperty("disabled");
});

test("the elements take the spec props and reject invalid combinations", () => {
  const _group = (
    <RadioGroup
      label="Contract"
      description="Choose a plan."
      errorMessage={<span>Required</span>}
      isPending={false}
      orientation="horizontal"
      value={null}
      onChange={(value) => value.startsWith("f")}
      isDisabled
      isInvalid
      isReadOnly
      isRequired
      name="contract">
      <Radio value="fixed">Fixed</Radio>
      <RadioGroupItem value="spot" aria-label="Spot" />
    </RadioGroup>
  );
  const _item = (
    <RadioItem value="a" controlPosition="end" isDisabled>
      <RadioItem.Title>Fixed</RadioItem.Title>
      <RadioItem.Description>Locked.</RadioItem.Description>
      <RadioItem.Content>Extra</RadioItem.Content>
      <RadioItem.Actions>Badge</RadioItem.Actions>
      <RadioItem.SubSection>Details</RadioItem.SubSection>
    </RadioItem>
  );
  const _itemGroup = (
    <RadioItemGroup label="Plans">
      <RadioItem value="fixed">Fixed</RadioItem>
    </RadioItemGroup>
  );
  const _icon = (
    <RadioIconButton value="list" size="icon-sm" aria-label="List">
      <svg />
    </RadioIconButton>
  );
  const _iconNeedsName = (
    // @ts-expect-error icon-only RadioIconButton requires aria-label
    <RadioIconButton value="list">
      <svg />
    </RadioIconButton>
  );
  const _itemClassNameString = <RadioGroupItem value="spot" aria-label="Spot" className="extra" />;
  const _itemClassNameCallback = (
    <RadioGroupItem
      value="spot"
      aria-label="Spot"
      className={(state) => (state.checked ? "is-checked" : undefined)}
    />
  );

  const _needsValue = (
    // @ts-expect-error value is required
    <Radio>Missing</Radio>
  );
  const _itemNeedsValue = (
    // @ts-expect-error value is required
    <RadioItem>Missing</RadioItem>
  );
  const _badPosition = (
    // @ts-expect-error controlPosition is start | end only
    <RadioItem value="a" controlPosition="top">
      A
    </RadioItem>
  );
  const _badOrientation = (
    // @ts-expect-error orientation is vertical | horizontal only
    <RadioGroup orientation="grid" />
  );
  const _badSize = (
    // @ts-expect-error size is the five-value icon map
    <RadioIconButton value="a" size="md" aria-label="A" />
  );
  const _noAs = (
    // @ts-expect-error polymorphism is never an as prop
    <RadioGroup as="div" />
  );
  const _nativeDisabled = (
    // @ts-expect-error native disabled is not on the composite face; use isDisabled
    <RadioGroup disabled />
  );
  const _nullDefault = (
    // @ts-expect-error defaultValue is string, not null
    <RadioGroup defaultValue={null} />
  );
});
