"use client";

import { useState } from "react";

import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemRevealedSubSection() {
  const [checked, setChecked] = useState(true);
  return (
    <Field.Root>
      <SelectionItem.Shell
        dataSlot="checkbox-item"
        control={<Checkbox checked={checked} onCheckedChange={setChecked} />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Price alert</SelectionItem.Title>
          <SelectionItem.Description>A text message when the spot price peaks.</SelectionItem.Description>
        </SelectionItem.Content>
        <SelectionItem.SubSection mode={checked ? "visible" : "hidden"}>
          <button type="button" className="text-sm underline underline-offset-4">
            Change the alert price
          </button>
        </SelectionItem.SubSection>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
