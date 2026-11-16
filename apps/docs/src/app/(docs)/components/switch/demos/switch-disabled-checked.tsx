"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchDisabledChecked() {
  return (
    <Field.Root>
      <Field.Label>Notifications</Field.Label>
      <Switch disabled defaultChecked />
    </Field.Root>
  );
}
