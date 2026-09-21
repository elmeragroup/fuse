"use client";

import { Field } from "@elmeragroup/fuse/field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Switch } from "@elmeragroup/fuse/switch";

export function SelectionItemDisabled() {
  return (
    <Field.Root>
      <SelectionItem.Shell dataSlot="checkbox-item" isDisabled control={<Switch disabled />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Legacy product</SelectionItem.Title>
          <SelectionItem.Description>No longer offered on this meter.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
