"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <TextField size="sm" label="Small" placeholder="name@example.com" className="w-56" />
      <TextField label="Default" placeholder="name@example.com" className="w-56" />
    </div>
  );
}
