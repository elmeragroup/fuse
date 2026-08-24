"use client";

import { InputGroup } from "@elmeragroup/ui/input-group";

export function InputGroupInvalid() {
  return (
    <div className="flex flex-col gap-4">
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text>NO</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Account number" aria-invalid defaultValue="12" />
      </InputGroup.Root>
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text>NO</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Locked account number" defaultValue="1234 56 78901" disabled />
      </InputGroup.Root>
    </div>
  );
}
