"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupButtonSmall() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Meter number" defaultValue="707057500012345678" readOnly />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button size="sm">Copy</InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
