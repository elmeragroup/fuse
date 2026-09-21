"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldNumeric() {
  return <TextField label="Meter number" filter="numeric" placeholder="Only digits" />;
}
