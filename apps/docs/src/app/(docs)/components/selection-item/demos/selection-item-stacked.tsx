"use client";

import { Field } from "@elmeragroup/ui/field";
import { SelectionItem } from "@elmeragroup/ui/selection-item";
import { Switch } from "@elmeragroup/ui/switch";

export function SelectionItemStacked() {
  return (
    <Field.Root className="gap-0">
      <SelectionItem.Shell dataSlot="radio-item" control={<Switch />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Spot</SelectionItem.Title>
          <SelectionItem.Description>Hourly price, no lock-in.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
      <SelectionItem.Shell dataSlot="radio-item" control={<Switch defaultChecked />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Fixed</SelectionItem.Title>
          <SelectionItem.Description>Locked for 12 months.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
      <SelectionItem.Shell dataSlot="radio-item" control={<Switch />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Variable</SelectionItem.Title>
          <SelectionItem.Description>Monthly average with a markup.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
