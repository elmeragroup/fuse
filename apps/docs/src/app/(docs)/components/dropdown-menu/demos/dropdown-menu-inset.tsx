"use client";

import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Copy, Trash } from "@elmeragroup/fuse/icons";

export function DropdownMenuInset() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>File</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>
          <Copy />
          Duplicate
        </DropdownMenu.Item>
        <DropdownMenu.Item inset>Rename</DropdownMenu.Item>
        <DropdownMenu.Item>
          <Trash />
          Move to trash
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
