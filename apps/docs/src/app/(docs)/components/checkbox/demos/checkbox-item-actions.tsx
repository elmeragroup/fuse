"use client";

import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";

export function CheckboxItemActions() {
  return (
    <CheckboxItemGroup label="Add-ons">
      <CheckboxItem value="price-alert">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Price alert</CheckboxItem.Title>
          <CheckboxItem.Description>A text message when the spot price peaks.</CheckboxItem.Description>
        </CheckboxItem.Content>
        <CheckboxItem.Actions>19 kr/month</CheckboxItem.Actions>
      </CheckboxItem>
    </CheckboxItemGroup>
  );
}
