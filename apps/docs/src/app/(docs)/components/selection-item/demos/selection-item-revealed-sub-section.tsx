"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
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
          <Button variant="link">Change the alert price</Button>
        </SelectionItem.SubSection>
      </SelectionItem.Shell>
    </Field.Root>
  );
}
