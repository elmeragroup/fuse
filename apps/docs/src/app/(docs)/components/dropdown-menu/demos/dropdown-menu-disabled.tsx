"use client";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

export function DropdownMenuDisabled() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" />}>Invoice</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Download</DropdownMenu.Item>
        <DropdownMenu.Item disabled>Send reminder</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
