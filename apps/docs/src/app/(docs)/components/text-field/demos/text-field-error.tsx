"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldError() {
  return <TextField label="Email" defaultValue="ada" isInvalid errorMessage="Enter a work email." />;
}
