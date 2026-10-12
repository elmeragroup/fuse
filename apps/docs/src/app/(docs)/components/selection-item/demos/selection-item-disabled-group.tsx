"use client";

import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";

export function SelectionItemDisabledGroup() {
  return (
    <CheckboxItemGroup
      label="Add-ons"
      description="Add-ons open once your agreement has started."
      isDisabled
      defaultValue={["price-alert"]}>
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
    </CheckboxItemGroup>
  );
}
