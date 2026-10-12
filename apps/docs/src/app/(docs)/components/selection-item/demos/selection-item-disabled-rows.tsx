"use client";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function SelectionItemDisabledRows() {
  return (
    <RadioItemGroup label="Start date" defaultValue="in-14-days">
      <RadioItem value="soonest">
        <RadioItem.Content>
          <RadioItem.Title>As soon as possible</RadioItem.Title>
          <RadioItem.Description>We start your agreement on the first free date.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
      <RadioItem value="in-14-days" isDisabled>
        <RadioItem.Content>
          <RadioItem.Title>In 14 days</RadioItem.Title>
          <RadioItem.Description>Your current agreement runs until then.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
      <RadioItem value="moving" isDisabled>
        <RadioItem.Content>
          <RadioItem.Title>On your moving date</RadioItem.Title>
          <RadioItem.Description>Only for a new address.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
    </RadioItemGroup>
  );
}
