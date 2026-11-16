"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldPending() {
  return <NumberField label="Quantity" defaultValue={2} isPending />;
}
