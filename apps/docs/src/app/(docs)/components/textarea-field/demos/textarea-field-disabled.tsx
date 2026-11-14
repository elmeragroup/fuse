"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldDisabled() {
  return <TextareaField label="Delivery notes" defaultValue="Ring twice." isDisabled />;
}
