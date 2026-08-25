"use client";

import { TextareaField } from "@elmeragroup/ui/textarea-field";

export function TextareaFieldDisabled() {
  return (
    <div className="flex flex-col gap-3">
      <TextareaField label="Disabled" isDisabled defaultValue="Cannot edit" />
      <TextareaField label="Required" isRequired placeholder="Required notes" />
    </div>
  );
}
