"use client";

import { useState } from "react";

import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

export function RadioItemSubSection() {
  const [value, setValue] = useState<string | null>("fixed");

  return (
    <RadioItemGroup label="Price plan" value={value} onChange={setValue}>
      <RadioItem value="fixed">
        <RadioItem.Content>
          <RadioItem.Title>Fixed price</RadioItem.Title>
          <RadioItem.Description>Locked for 12 months.</RadioItem.Description>
        </RadioItem.Content>
        <RadioItem.SubSection mode={value === "fixed" ? "visible" : "hidden"}>
          Includes a price-freeze guarantee.
        </RadioItem.SubSection>
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
