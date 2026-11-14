"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarToggleGroup() {
  return (
    <Toolbar.Root aria-label="Text">
      <ToggleGroup.Root aria-label="Alignment" size="sm" defaultValue={["left"]}>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Separator />
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Clear formatting</Toolbar.Button>
    </Toolbar.Root>
  );
}
