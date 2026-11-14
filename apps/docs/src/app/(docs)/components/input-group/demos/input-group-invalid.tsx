"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupInvalid() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon>
        <InputGroup.Text>+47</InputGroup.Text>
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Mobile number" type="tel" defaultValue="4123" aria-invalid />
    </InputGroup.Root>
  );
}
