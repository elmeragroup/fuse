"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";

export function DropdownMenuCheckboxes() {
  const [showToolbar, setShowToolbar] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" />}>View</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Label>Editor</DropdownMenu.Label>
        <DropdownMenu.CheckboxItem checked={showToolbar} onCheckedChange={setShowToolbar}>
          Show toolbar
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={showMinimap} onCheckedChange={setShowMinimap}>
          Show minimap
        </DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
