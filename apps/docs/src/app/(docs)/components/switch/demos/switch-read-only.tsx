"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchReadOnly() {
  return (
    <Field.Root>
      <Field.Label>Notifications</Field.Label>
      <Switch readOnly defaultChecked />
    </Field.Root>
  );
}
