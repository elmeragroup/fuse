"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldReadOnly() {
  return <TextareaField label="Delivery notes" defaultValue="Ring twice." readOnly />;
}
