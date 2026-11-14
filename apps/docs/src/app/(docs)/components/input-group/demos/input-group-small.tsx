"use client";

import { MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupSmall() {
  return (
    <InputGroup.Root size="sm">
      <InputGroup.Addon>
        <MagnifyingGlass />
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Search customers" placeholder="Search customers" />
    </InputGroup.Root>
  );
}
