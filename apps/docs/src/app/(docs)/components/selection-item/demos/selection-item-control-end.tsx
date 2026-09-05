"use client";

import { Field } from "@elmeragroup/ui/field";
import { SelectionItem } from "@elmeragroup/ui/selection-item";
import { Switch } from "@elmeragroup/ui/switch";

export function SelectionItemControlEnd() {
  return (
    <Field.Root>
      <SelectionItem.Shell dataSlot="radio-item" controlPosition="end" control={<Switch defaultChecked />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Company agreement</SelectionItem.Title>
          <SelectionItem.Description>
            Trailing indicator via the control escape hatch.
          </SelectionItem.Description>
        </SelectionItem.Content>
        <SelectionItem.SubSection>Aligned with the text column, not the control.</SelectionItem.SubSection>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
