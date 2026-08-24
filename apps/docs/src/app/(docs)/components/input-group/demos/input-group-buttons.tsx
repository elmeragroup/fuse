"use client";

import { X } from "@elmeragroup/ui/icons";
import { InputGroup } from "@elmeragroup/ui/input-group";

export function InputGroupButtons() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Meter number" defaultValue="707057500012345678" />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button>Copy</InputGroup.Button>
        <InputGroup.Button size="icon-xs" aria-label="Clear meter number">
          <X />
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
