"use client";

import { useState } from "react";

import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";

export function CheckboxItemGroupDemo() {
  const [value, setValue] = useState<string[]>(["fixed"]);
  const fixedSelected = value.includes("fixed");

  return (
    <CheckboxItemGroup label="Price plans" value={value} onChange={setValue}>
      <CheckboxItem value="fixed">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Fixed price</CheckboxItem.Title>
          <CheckboxItem.Description>Locked for 12 months.</CheckboxItem.Description>
        </CheckboxItem.Content>
        <CheckboxItem.Actions>Recommended</CheckboxItem.Actions>
        <CheckboxItem.SubSection
          role="region"
          aria-label="Fixed price details"
          mode={fixedSelected ? "visible" : "hidden"}>
          Includes a price-freeze guarantee.
        </CheckboxItem.SubSection>
      </CheckboxItem>
      <CheckboxItem value="spot">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Spot price</CheckboxItem.Title>
          <CheckboxItem.Description>Follows the market.</CheckboxItem.Description>
        </CheckboxItem.Content>
      </CheckboxItem>
    </CheckboxItemGroup>
  );
}
