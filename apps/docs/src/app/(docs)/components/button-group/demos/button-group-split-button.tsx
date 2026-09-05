"use client";

import { Button } from "@elmeragroup/ui/button";
import { ButtonGroup } from "@elmeragroup/ui/button-group";
import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";
import { CaretDown } from "@elmeragroup/ui/icons";

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
