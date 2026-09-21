"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldPendingSuccess() {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Checking availability" isPending />
      <TextField label="Verified" isSuccess defaultValue="7070575000" />
      <TextField aria-label="Pending without a label" isPending />
    </div>
  );
}
