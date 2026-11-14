"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldReadOnly() {
  return <NumberField label="Quantity" defaultValue={4} isReadOnly />;
}
