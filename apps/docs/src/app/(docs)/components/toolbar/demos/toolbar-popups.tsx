"use client";

import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { CaretDown, Copy } from "@elmeragroup/fuse/icons";
import { Input } from "@elmeragroup/fuse/input";
import { Popover } from "@elmeragroup/fuse/popover";
import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function ToolbarPopups() {
  return (
    <Tooltip.Provider>
      <Toolbar.Root aria-label="Layer">
        <Popover.Root>
          <Toolbar.Button render={<Popover.Trigger render={<Button variant="ghost" size="sm" />} />}>
            Size
          </Toolbar.Button>
          <Popover.Content>
            <Popover.Header>
              <Popover.Title>Size</Popover.Title>
              <Popover.Description>Set the width of the layer.</Popover.Description>
            </Popover.Header>
            <Field.Root>
              <Field.Label>Width</Field.Label>
              <Input defaultValue="320" />
            </Field.Root>
          </Popover.Content>
        </Popover.Root>
        <DropdownMenu.Root>
          <Toolbar.Button render={<DropdownMenu.Trigger render={<Button variant="ghost" size="sm" />} />}>
            Arrange
            <CaretDown data-icon="inline-end" aria-hidden />
          </Toolbar.Button>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Bring to front</DropdownMenu.Item>
            <DropdownMenu.Item>Send to back</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Toolbar.Separator />
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Duplicate" />} />
            }>
            <Copy aria-hidden />
          </Tooltip.Trigger>
          <Tooltip.Content>Duplicate</Tooltip.Content>
        </Tooltip.Root>
      </Toolbar.Root>
    </Tooltip.Provider>
  );
}
