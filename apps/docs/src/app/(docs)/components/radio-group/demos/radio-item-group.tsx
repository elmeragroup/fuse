"use client";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function RadioItemGroupDemo() {
  return (
    <RadioItemGroup label="Price plan" defaultValue="fixed">
      <RadioItem value="fixed">
        <RadioItem.Content>
          <RadioItem.Title>Fixed price</RadioItem.Title>
          <RadioItem.Description>Locked for 12 months.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
      <RadioItem value="spot">
        <RadioItem.Content>
          <RadioItem.Title>Spot price</RadioItem.Title>
          <RadioItem.Description>Follows the hourly market.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
    </RadioItemGroup>
  );
}
