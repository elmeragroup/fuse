"use client";

import { Checkbox } from "@elmeragroup/ui/checkbox";
import { Field } from "@elmeragroup/ui/field";

export function FieldSetDemo() {
  return (
    <Field.Set>
      <Field.Legend>Notifications</Field.Legend>
      <Field.Root>
        <Field.Item>
          <Field.Label className="flex items-center gap-2">
            <Checkbox defaultChecked />
            Email
          </Field.Label>
        </Field.Item>
        <Field.Item>
          <Field.Label className="flex items-center gap-2">
            <Checkbox />
            SMS
          </Field.Label>
        </Field.Item>
      </Field.Root>
    </Field.Set>
  );
}
