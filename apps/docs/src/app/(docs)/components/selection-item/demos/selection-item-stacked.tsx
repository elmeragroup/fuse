"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemStacked() {
  return (
    <Field.Root>
      <div className="flex flex-col">
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox />}>
          <SelectionItem.Content>
            <SelectionItem.Title>Price alert</SelectionItem.Title>
            <SelectionItem.Description>A text message when the spot price peaks.</SelectionItem.Description>
          </SelectionItem.Content>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox defaultChecked />}>
          <SelectionItem.Content>
            <SelectionItem.Title>Electric car charging</SelectionItem.Title>
            <SelectionItem.Description>A night rate for your home charger.</SelectionItem.Description>
          </SelectionItem.Content>
        </SelectionItem.Shell>
        <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox />}>
          <SelectionItem.Content>
            <SelectionItem.Title>Solar sell-back</SelectionItem.Title>
            <SelectionItem.Description>Sell what your panels produce to the grid.</SelectionItem.Description>
          </SelectionItem.Content>
        </SelectionItem.Shell>
      </div>
    </Field.Root>
  );
}
