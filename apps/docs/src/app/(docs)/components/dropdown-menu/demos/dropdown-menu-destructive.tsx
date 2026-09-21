"use client";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Trash, User } from "@elmeragroup/fuse/icons";

export function DropdownMenuDestructive() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" />}>Open</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Group>
          <DropdownMenu.Label inset>Account</DropdownMenu.Label>
          <DropdownMenu.Item inset>
            <User />
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item inset disabled>
            Billing
          </DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Item inset variant="destructive">
          <Trash />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
