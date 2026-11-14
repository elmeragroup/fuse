"use client";

import { Textarea } from "@elmeragroup/fuse/textarea";

export function TextareaReadOnly() {
  return <Textarea aria-label="Notes" defaultValue="Leave the parcel by the door." readOnly />;
}
