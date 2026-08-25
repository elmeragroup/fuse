"use client";

import { TextField } from "@elmeragroup/ui/text-field";

export function TextFieldNumeric() {
  return <TextField label="Meter number" filter="numeric" placeholder="Only digits" />;
}
