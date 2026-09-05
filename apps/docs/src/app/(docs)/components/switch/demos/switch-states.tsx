"use client";

import { Field } from "@elmeragroup/ui/field";
import { Switch } from "@elmeragroup/ui/switch";

export function SwitchStates() {
  return (
    <div className="flex flex-col gap-4">
      <Field.Root>
        <Field.Label>Disabled off</Field.Label>
        <Switch disabled />
      </Field.Root>
      <Field.Root>
        <Field.Label>Disabled on</Field.Label>
        <Switch disabled defaultChecked />
      </Field.Root>
      <Field.Root invalid>
        <Field.Label>Required setting</Field.Label>
        <Switch />
        <Field.Error>Turn this on to continue.</Field.Error>
      </Field.Root>
    </div>
  );
}
