"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldCard() {
  return <TextField variant="card" label="Annual usage" description="Estimated kWh" placeholder="0" />;
}
