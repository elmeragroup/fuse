"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldSuccess() {
  return <NumberField label="Quantity" defaultValue={2} isSuccess />;
}
