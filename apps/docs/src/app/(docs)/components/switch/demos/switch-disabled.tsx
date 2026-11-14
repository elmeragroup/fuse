"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchDisabled() {
  return (
    <Field.Root>
      <Field.Label>Notifications</Field.Label>
      <Switch disabled />
    </Field.Root>
  );
}
