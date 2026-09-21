"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldError() {
  return (
    <TextField
      label="Email"
      description="Work address preferred."
      isInvalid
      errorMessage="Enter a work email."
    />
  );
}
