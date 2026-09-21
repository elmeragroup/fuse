"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { CaretDown } from "@elmeragroup/fuse/icons";

export function ButtonGroupSplitButton() {
  return (
    <ButtonGroup.Root aria-label="Save">
      <Button variant="secondary">Save</Button>
      <ButtonGroup.Separator />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          render={<Button variant="secondary" size="icon" aria-label="More save options" />}>
          <CaretDown />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Save as draft</DropdownMenu.Item>
          <DropdownMenu.Item>Save and close</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </ButtonGroup.Root>
  );
}
