"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupBlockEnd() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Meter reading" filter="numeric" placeholder="12345" />
      <InputGroup.Addon align="block-end">
        <InputGroup.Text>Read the digits before the comma.</InputGroup.Text>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
