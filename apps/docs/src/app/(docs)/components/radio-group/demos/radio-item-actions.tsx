"use client";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function RadioItemActions() {
  return (
    <RadioItemGroup label="Price plan" defaultValue="fixed">
      <RadioItem value="fixed">
        <RadioItem.Content>
          <RadioItem.Title>Fixed price</RadioItem.Title>
          <RadioItem.Description>Locked for 12 months.</RadioItem.Description>
        </RadioItem.Content>
        <RadioItem.Actions>1.29 kr/kWh</RadioItem.Actions>
      </RadioItem>
    </RadioItemGroup>
  );
}
