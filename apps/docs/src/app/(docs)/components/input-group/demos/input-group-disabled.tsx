"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupDisabled() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon>
        <InputGroup.Text>+47</InputGroup.Text>
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Mobile number" type="tel" defaultValue="91234567" disabled />
    </InputGroup.Root>
  );
}
