"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldCounter() {
  return <TextareaField label="Delivery notes" defaultValue="Ring twice." maxLength={120} />;
}
