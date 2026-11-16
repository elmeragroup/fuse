"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldNumeric() {
  return (
    <TextField label="Mobile number" type="tel" filter="numeric" maxLength={8} placeholder="912 34 567" />
  );
}
