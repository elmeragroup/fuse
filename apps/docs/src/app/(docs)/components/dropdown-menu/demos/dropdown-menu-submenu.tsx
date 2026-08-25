"use client";

import { Button } from "@elmeragroup/ui/button";
import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";

export function DropdownMenuSubmenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" />}>Open</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>New tab</DropdownMenu.Item>
        <DropdownMenu.Item>New window</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.Item>Email link</DropdownMenu.Item>
            <DropdownMenu.Item>Copy link</DropdownMenu.Item>
            <DropdownMenu.Item>Messages</DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
