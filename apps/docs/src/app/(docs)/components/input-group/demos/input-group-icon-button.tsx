"use client";

import { X } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupIconButton() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Meter number" defaultValue="707057500012345678" />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button size="icon-xs" aria-label="Clear meter number">
          <X />
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
