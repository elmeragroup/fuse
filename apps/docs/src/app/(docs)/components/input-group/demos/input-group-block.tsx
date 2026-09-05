"use client";

import { InputGroup } from "@elmeragroup/ui/input-group";

export function InputGroupBlock() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon align="block-start">
        <InputGroup.Text>Meter reading</InputGroup.Text>
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Meter reading" inputMode="numeric" placeholder="12345" />
      <InputGroup.Addon align="block-end">
        <InputGroup.Text>Read the digits before the comma.</InputGroup.Text>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
