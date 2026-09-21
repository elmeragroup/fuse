"use client";

import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchSizes() {
  return (
    <div className="flex flex-col gap-4">
      <Field.Root>
        <Field.Label>Small</Field.Label>
        <Switch size="sm" />
      </Field.Root>
      <Field.Root>
        <Field.Label>Default</Field.Label>
        <Switch size="default" />
      </Field.Root>
    </div>
  );
}
