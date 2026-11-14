"use client";

import { Checkbox, CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";

export function SelectionItemHorizontal() {
  return (
    <CheckboxGroup label="Add-ons" orientation="horizontal" defaultValue={["ev-charging"]}>
      <SelectionItem.Shell
        dataSlot="checkbox-item"

        control={<Checkbox value="price-alert" />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Price alert</SelectionItem.Title>
          <SelectionItem.Description>A text message when the price peaks.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
      <SelectionItem.Shell
        dataSlot="checkbox-item"

        control={<Checkbox value="ev-charging" />}>
        <SelectionItem.Content>
          <SelectionItem.Title>Electric car charging</SelectionItem.Title>
          <SelectionItem.Description>A night rate for your charger.</SelectionItem.Description>
        </SelectionItem.Content>
      </SelectionItem.Shell>
    </CheckboxGroup>
  );
}
