"use client";

import { useState } from "react";

import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";

export function CheckboxItemSubSection() {
  const [value, setValue] = useState<string[]>(["price-alert"]);

  return (
    <CheckboxItemGroup label="Add-ons" value={value} onChange={setValue}>
      <CheckboxItem value="price-alert">
        <CheckboxItem.Content>
          <CheckboxItem.Title>Price alert</CheckboxItem.Title>
          <CheckboxItem.Description>A text message when the spot price peaks.</CheckboxItem.Description>
        </CheckboxItem.Content>
        <CheckboxItem.SubSection mode={value.includes("price-alert") ? "visible" : "hidden"}>
          <button type="button" className="text-sm underline underline-offset-4">
            Change the alert price
          </button>
        </CheckboxItem.SubSection>
      </CheckboxItem>
    </CheckboxItemGroup>
  );
}
