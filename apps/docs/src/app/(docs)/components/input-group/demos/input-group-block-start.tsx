"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupBlockStart() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon align="block-start">
        <InputGroup.Text>Meter reading</InputGroup.Text>
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Meter reading" filter="numeric" placeholder="12345" />
    </InputGroup.Root>
  );
}
