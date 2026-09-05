"use client";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

export function InputStates() {
  return (
    <div className="flex flex-col gap-3">
      <Input aria-label="Disabled" disabled />
      <Input aria-label="Read only" readOnly defaultValue="Locked" />
      <Field.Root invalid>
        <Field.Label>Invalid</Field.Label>
        <Input />
        <Field.Error>Required</Field.Error>
      </Field.Root>
    </div>
  );
}
