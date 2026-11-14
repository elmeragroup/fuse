"use client";

import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarMenu() {
  return (
    <Toolbar.Root aria-label="Layer">
      <Toolbar.Button>Duplicate</Toolbar.Button>
      <DropdownMenu.Root>
        <Toolbar.Button render={<DropdownMenu.Trigger />}>Arrange</Toolbar.Button>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Bring to front</DropdownMenu.Item>
          <DropdownMenu.Item>Send to back</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Toolbar.Root>
  );
}
