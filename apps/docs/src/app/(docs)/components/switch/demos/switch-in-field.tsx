"use client";

import { useState } from "react";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchInField() {
  const [enabled, setEnabled] = useState(true);
  return (
    <Field.Root>
      <Field.Label>Notifications</Field.Label>
      <Switch checked={enabled} onCheckedChange={setEnabled} />
    </Field.Root>
  );
}
