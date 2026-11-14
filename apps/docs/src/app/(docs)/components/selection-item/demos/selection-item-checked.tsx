"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemChecked() {
  return (
    <Field.Root>
      <SelectionItem.Shell dataSlot="checkbox-item" control={<Checkbox defaultChecked />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Price alert</SelectionItem.Title>
          <SelectionItem.Description>A text message when the spot price peaks.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
