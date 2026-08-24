"use client";

import { Field } from "@elmeragroup/ui/field";

export function FieldSetDemo() {
  return (
    <Field.Set>
      <Field.Legend>Notifications</Field.Legend>
      <Field.Root>
        <Field.Item>
          <label>
            <input type="checkbox" /> Email
          </label>
        </Field.Item>
        <Field.Item>
          <label>
            <input type="checkbox" /> SMS
          </label>
        </Field.Item>
      </Field.Root>
    </Field.Set>
  );
}
