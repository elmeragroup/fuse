"use client";

import { InputGroup } from "@elmeragroup/fuse/input-group";

export function InputGroupButtonDemo() {
  return (
    <InputGroup.Root>
      <InputGroup.Input aria-label="Meter number" defaultValue="707057500012345678" readOnly />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button>Copy</InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}
