"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";
import { Popover } from "@elmeragroup/fuse/popover";

export function PopoverBasic() {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline" />}>Details</Popover.Trigger>
      <Popover.Content>
        <Popover.Header>
          <Popover.Title>Dimensions</Popover.Title>
          <Popover.Description>Set the dimensions for the layer.</Popover.Description>
        </Popover.Header>
        <Field.Root>
          <Field.Label>Width</Field.Label>
          <Input />
        </Field.Root>
        <Field.Root>
          <Field.Label>Height</Field.Label>
          <Input />
        </Field.Root>
      </Popover.Content>
    </Popover.Root>
  );
}
