"use client";

import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";

export function SelectionItemCheckboxAdjacent() {
  return (
    <CheckboxItemGroup label="Add-ons" defaultValue={["ev-charging", "solar"]}>
      <CheckboxItem value="price-alert">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Price alert</CheckboxItem.Title>
          <CheckboxItem.Description>A text message when the spot price peaks.</CheckboxItem.Description>
        </CheckboxItem.Content>
      </CheckboxItem>
      <CheckboxItem value="ev-charging">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Electric car charging</CheckboxItem.Title>
          <CheckboxItem.Description>A night rate for your home charger.</CheckboxItem.Description>
        </CheckboxItem.Content>
      </CheckboxItem>
      <CheckboxItem value="solar">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Solar sell-back</CheckboxItem.Title>
          <CheckboxItem.Description>Sell what your panels produce to the grid.</CheckboxItem.Description>
        </CheckboxItem.Content>
      </CheckboxItem>
      <CheckboxItem value="appliance-cover">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Appliance cover</CheckboxItem.Title>
          <CheckboxItem.Description>Repairs for your heat pump and water heater.</CheckboxItem.Description>
        </CheckboxItem.Content>
      </CheckboxItem>
    </CheckboxItemGroup>
  );
}
