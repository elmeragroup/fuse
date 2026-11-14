"use client";

import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

export function DropdownMenuDisabled() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>Invoice</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Download</DropdownMenu.Item>
        <DropdownMenu.Item disabled>Send reminder</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
