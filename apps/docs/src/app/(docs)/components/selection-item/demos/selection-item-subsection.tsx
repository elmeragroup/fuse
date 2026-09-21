"use client";

import { useState } from "react";

import { Field } from "@elmeragroup/fuse/field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Switch } from "@elmeragroup/fuse/switch";

export function SelectionItemSubsection() {
  const [selected, setSelected] = useState(true);
  return (
    <Field.Root>
      <SelectionItem.Shell
        dataSlot="checkbox-item"
        control={<Switch checked={selected} onCheckedChange={setSelected} />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Spot price</SelectionItem.Title>
          <SelectionItem.Description>Follows the hourly market rate.</SelectionItem.Description>
        </SelectionItem.Content>
        <SelectionItem.SubSection mode={selected ? "visible" : "hidden"}>
          <button type="button">Edit meter details</button>
        </SelectionItem.SubSection>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
