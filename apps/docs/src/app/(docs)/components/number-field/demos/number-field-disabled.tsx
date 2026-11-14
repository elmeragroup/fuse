"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldDisabled() {
  return <NumberField label="Quantity" defaultValue={4} isDisabled />;
}
