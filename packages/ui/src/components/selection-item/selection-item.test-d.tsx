import { expectTypeOf, test } from "vitest";

import type { SelectionItem as RootSelectionItem } from "@elmeragroup/ui";
import { Item } from "@elmeragroup/ui/item";
import * as SelectionItemModule from "@elmeragroup/ui/selection-item";
import { SelectionItem } from "@elmeragroup/ui/selection-item";

test("the namespace ships all six parts from the selection-item entry and the root barrel", () => {
  expectTypeOf<typeof SelectionItem>().toEqualTypeOf<typeof RootSelectionItem>();
  expectTypeOf(SelectionItem).toHaveProperty("Shell");
  expectTypeOf(SelectionItem).toHaveProperty("Title");
  expectTypeOf(SelectionItem).toHaveProperty("Description");
  expectTypeOf(SelectionItem).toHaveProperty("Content");
  expectTypeOf(SelectionItem).toHaveProperty("Actions");
  expectTypeOf(SelectionItem).toHaveProperty("SubSection");
});

test("public API exports only the namespace — aliases and recipes stay out of this entry", () => {
  expectTypeOf(SelectionItemModule).not.toHaveProperty("CheckboxItem");
  expectTypeOf(SelectionItemModule).not.toHaveProperty("RadioItem");
  expectTypeOf(SelectionItemModule).not.toHaveProperty("itemVariants");
  expectTypeOf(SelectionItemModule).not.toHaveProperty("selectionItemVariants");
  expectTypeOf(SelectionItemModule).not.toHaveProperty("SelectionItemShell");
  expectTypeOf(SelectionItemModule).not.toHaveProperty("SelectionItemTitle");
});

test("Description and Content are the Item parts so later aliasing keeps object identity", () => {
  expectTypeOf(SelectionItem.Description).toEqualTypeOf(Item.Description);
  expectTypeOf(SelectionItem.Content).toEqualTypeOf(Item.Content);
});

test("Shell takes the spec surface and no polymorphic as prop", () => {
  expectTypeOf<Parameters<typeof SelectionItem.Shell>[0]["dataSlot"]>().toEqualTypeOf<string>();
  expectTypeOf<Parameters<typeof SelectionItem.Shell>[0]["controlPosition"]>().toEqualTypeOf<
    "start" | "end" | undefined
  >();
  expectTypeOf<Parameters<typeof SelectionItem.Shell>[0]["isDisabled"]>().toEqualTypeOf<
    boolean | undefined
  >();
  expectTypeOf<Parameters<typeof SelectionItem.Shell>[0]>().not.toHaveProperty("as");
  expectTypeOf<Parameters<typeof SelectionItem.SubSection>[0]["mode"]>().toEqualTypeOf<
    "default" | "visible" | "hidden" | undefined
  >();

  const _tree = (
    <SelectionItem.Shell dataSlot="checkbox-item" control={<span />} controlPosition="end" isDisabled>
      <SelectionItem.Content>
        <SelectionItem.Title>Fixed price</SelectionItem.Title>
        <SelectionItem.Description>Locked for 12 months.</SelectionItem.Description>
      </SelectionItem.Content>
      <SelectionItem.Actions>Badge</SelectionItem.Actions>
      <SelectionItem.SubSection mode="hidden">Details</SelectionItem.SubSection>
    </SelectionItem.Shell>
  );

  const _render = (
    <SelectionItem.Shell dataSlot="radio-item" control={<span />} render={<article />}>
      <SelectionItem.Title>Article row</SelectionItem.Title>
    </SelectionItem.Shell>
  );

  // @ts-expect-error dataSlot is required
  const _needsSlot = <SelectionItem.Shell control={<span />} />;
  // @ts-expect-error control is required
  const _needsControl = <SelectionItem.Shell dataSlot="checkbox-item" />;
  const _badPosition = (
    // @ts-expect-error controlPosition is start | end only
    <SelectionItem.Shell dataSlot="checkbox-item" control={<span />} controlPosition="top" />
  );
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <SelectionItem.Shell dataSlot="checkbox-item" control={<span />} as="section" />;
});
