"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupNumeric() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon>
        <InputGroup.Text>+47</InputGroup.Text>
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Mobile number" type="tel" filter="numeric" maxLength={8} />
    </InputGroup.Root>
  );
}
