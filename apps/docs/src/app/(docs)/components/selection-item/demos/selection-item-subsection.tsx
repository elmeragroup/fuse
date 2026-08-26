"use client";

import { useState } from "react";

import { Field } from "@elmeragroup/ui/field";
import { SelectionItem } from "@elmeragroup/ui/selection-item";
import { Switch } from "@elmeragroup/ui/switch";

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
        <SelectionItem.SubSection mode={selected ? "visible" : "hidden"} inert={selected ? undefined : true}>
          <button type="button">Edit meter details</button>
        </SelectionItem.SubSection>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
