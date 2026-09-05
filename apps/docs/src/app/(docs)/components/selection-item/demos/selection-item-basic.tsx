"use client";

import { Field } from "@elmeragroup/ui/field";
import { SelectionItem } from "@elmeragroup/ui/selection-item";

export function SelectionItemBasic() {
  return (
    <Field.Root>
      <SelectionItem.Shell
        dataSlot="radio-item"
        control={<input type="radio" name="price-plan" value="fixed" defaultChecked className="size-4" />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Fixed price</SelectionItem.Title>
          <SelectionItem.Description>Locked for 12 months.</SelectionItem.Description>
        </SelectionItem.Content>
        <SelectionItem.Actions>Recommended</SelectionItem.Actions>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
