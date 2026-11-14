"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchChecked() {
  return (
    <Field.Root>
      <Field.Label>Notifications</Field.Label>
      <Switch defaultChecked />
    </Field.Root>
  );
}
