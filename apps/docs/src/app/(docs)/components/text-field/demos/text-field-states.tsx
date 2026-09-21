"use client";

import { TextField } from "@elmeragroup/fuse/text-field";

export function TextFieldStates() {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Disabled" isDisabled defaultValue="Cannot edit" />
      <TextField label="Read only" isReadOnly defaultValue="Locked" />
      <TextField label="Required" isRequired placeholder="Required field" />
    </div>
  );
}
