"use client";

import { useState } from "react";

import { RadioItem, RadioItemGroup } from "@elmeragroup/ui/radio-group";

export function RadioItemGroupDemo() {
  const [value, setValue] = useState("fixed");
  const fixedSelected = value === "fixed";

  return (
    <RadioItemGroup label="Price plans" value={value} onChange={setValue}>
      <RadioItem value="fixed">
        <RadioItem.Content>
          <RadioItem.Title>Fixed price</RadioItem.Title>
          <RadioItem.Description>Locked for 12 months.</RadioItem.Description>
        </RadioItem.Content>
        <RadioItem.Actions>Recommended</RadioItem.Actions>
        <RadioItem.SubSection
          role="region"
          aria-label="Fixed price details"
          mode={fixedSelected ? "visible" : "hidden"}
          inert={fixedSelected ? undefined : true}>
          Includes a price-freeze guarantee.
        </RadioItem.SubSection>
      </RadioItem>
      <RadioItem value="spot">
        <RadioItem.Content>
          <RadioItem.Title>Spot price</RadioItem.Title>
          <RadioItem.Description>Follows the market.</RadioItem.Description>
        </RadioItem.Content>
      </RadioItem>
    </RadioItemGroup>
  );
}
