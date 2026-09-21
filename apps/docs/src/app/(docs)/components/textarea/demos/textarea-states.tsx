"use client";

import { Textarea } from "@elmeragroup/fuse/textarea";

export function TextareaStates() {
  return (
    <div className="max-w-sm flex w-full flex-col gap-3">
      <Textarea aria-label="Disabled" disabled />
      <Textarea aria-label="Read only" readOnly defaultValue="Locked" />
      <Textarea aria-label="Invalid" aria-invalid />
    </div>
  );
}
