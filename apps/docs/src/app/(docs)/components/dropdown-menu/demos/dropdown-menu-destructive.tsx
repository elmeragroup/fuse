"use client";

import { Button } from "@elmeragroup/ui/button";
import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";
import { Trash, User } from "@elmeragroup/ui/icons";

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
