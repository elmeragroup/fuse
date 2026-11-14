"use client";

import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Trash } from "@elmeragroup/fuse/icons";

export function DropdownMenuDestructive() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>Invoice</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Download</DropdownMenu.Item>
        <DropdownMenu.Item variant="destructive">
          <Trash />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
