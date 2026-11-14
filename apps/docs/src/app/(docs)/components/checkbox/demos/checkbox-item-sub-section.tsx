"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
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
          <Button variant="link">Change the alert price</Button>
        </CheckboxItem.SubSection>
      </CheckboxItem>
    </CheckboxItemGroup>
  );
}
