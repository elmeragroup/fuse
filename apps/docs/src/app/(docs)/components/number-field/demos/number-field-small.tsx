"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldSmall() {
  return <NumberField size="sm" label="Quantity" defaultValue={1} minValue={0} />;
}
