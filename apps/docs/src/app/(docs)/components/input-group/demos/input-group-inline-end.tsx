"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupInlineEnd() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Annual usage" filter="numeric" />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Text>kWh</InputGroup.Text>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
