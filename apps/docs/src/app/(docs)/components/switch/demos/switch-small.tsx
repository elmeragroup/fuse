"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchSmall() {
  return (
    <Field.Root>
      <Field.Label>Notifications</Field.Label>
      <Switch size="sm" />
    </Field.Root>
  );
}
