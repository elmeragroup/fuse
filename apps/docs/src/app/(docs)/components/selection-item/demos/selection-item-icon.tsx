"use client";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { Bell } from "@elmeragroup/fuse/icons";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemIcon() {
  return (
    <Field.Root>
      <SelectionItem.Shell
        dataSlot="checkbox-item"
        control={
          <span className="flex items-center gap-2.5">
            <Checkbox />
            <Bell aria-hidden />
          </span>
        }>
        <SelectionItem.Content>
          <SelectionItem.Title>Price alert</SelectionItem.Title>
          <SelectionItem.Description>A text message when the spot price peaks.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
