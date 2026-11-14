"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchInvalid() {
  return (
    <Field.Root invalid>
      <Field.Label>Accept the terms</Field.Label>
      <Switch />
      <Field.Error>Turn this on to continue.</Field.Error>
    </Field.Root>
  );
}
