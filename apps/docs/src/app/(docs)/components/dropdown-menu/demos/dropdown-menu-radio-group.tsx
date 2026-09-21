"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

export function DropdownMenuRadioGroup() {
  const [panel, setPanel] = useState("status");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" />}>Panel</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.RadioGroup value={panel} onValueChange={setPanel}>
          <DropdownMenu.Label>Visible panel</DropdownMenu.Label>
          <DropdownMenu.RadioItem value="status">Status bar</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="activity">Activity bar</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="panel">Panel</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
