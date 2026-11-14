"use client";

import { X } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupIconButtonSmall() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Meter number" defaultValue="707057500012345678" />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button size="icon-sm" aria-label="Clear meter number">
          <X />
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
