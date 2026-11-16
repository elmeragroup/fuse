"use client";

import { MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupDemo() {
  return (
    <InputGroup.Root>
      <InputGroup.Addon>
        <MagnifyingGlass />
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Search customers" placeholder="Search customers" />
    </InputGroup.Root>
  );
}
