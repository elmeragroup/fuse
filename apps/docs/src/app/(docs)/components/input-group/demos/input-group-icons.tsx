"use client";

import { MagnifyingGlass } from "@elmeragroup/ui/icons";
import { InputGroup } from "@elmeragroup/ui/input-group";

export function InputGroupIcons() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon>
        <MagnifyingGlass />
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Search customers" placeholder="Search customers…" />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Text>kWh</InputGroup.Text>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
