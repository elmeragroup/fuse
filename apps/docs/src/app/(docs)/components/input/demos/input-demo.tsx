"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";

export function InputDemo() {
  return (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <Input type="email" placeholder="name@example.com" />
    </Field.Root>
  );
}
