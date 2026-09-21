"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldError() {
  return (
    <TextareaField
      label="Bio"
      description="Shown to other users."
      isInvalid
      errorMessage={<span>Keep it under 120 characters.</span>}
      defaultValue="This bio is too long for the directory listing."
    />
  );
}
