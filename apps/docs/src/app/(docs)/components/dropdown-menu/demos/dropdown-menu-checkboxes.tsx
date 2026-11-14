"use client";

import { useState } from "react";

import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

export function DropdownMenuCheckboxes() {
  const [showToolbar, setShowToolbar] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>View</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Group>
          <DropdownMenu.Label>Editor</DropdownMenu.Label>
          <DropdownMenu.CheckboxItem checked={showToolbar} onCheckedChange={setShowToolbar}>
            Show toolbar
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={showMinimap} onCheckedChange={setShowMinimap}>
            Show minimap
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
