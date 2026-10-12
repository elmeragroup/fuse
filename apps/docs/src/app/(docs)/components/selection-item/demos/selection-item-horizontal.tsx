"use client";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function SelectionItemHorizontal() {
  return (
    <RadioItemGroup label="Contract length" orientation="horizontal" defaultValue="12-months">
      <RadioItem value="12-months">
        <RadioItem.Content>
          <RadioItem.Title>12 months</RadioItem.Title>
          <RadioItem.Description>Fixed price, renews monthly after.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
      <RadioItem value="36-months">
        <RadioItem.Content>
          <RadioItem.Title>36 months</RadioItem.Title>
          <RadioItem.Description>Lowest fixed price per kWh.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
    </RadioItemGroup>
  );
}
