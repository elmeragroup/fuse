"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function FieldGridSetDemo() {
  return (
    <Field.Set className="grid grid-cols-2 gap-x-4 gap-y-6">
      <Field.Legend render={<legend />}>Delivery address</Field.Legend>
      <Field.Root>
        <Field.Label>Postcode</Field.Label>
        <Input autoComplete="postal-code" />
      </Field.Root>
      <Field.Root>
        <Field.Label>City</Field.Label>
        <Input autoComplete="address-level2" />
      </Field.Root>
    </Field.Set>
  );
}
