"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldUncontrolled() {
  return (
    <TextareaField
      label="Notes"
      description="Typing works without onChange."
      defaultValue="Started here."
      maxLength={120}
    />
  );
}
