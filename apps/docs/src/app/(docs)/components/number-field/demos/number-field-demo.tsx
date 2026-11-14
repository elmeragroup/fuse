"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldDemo() {
  return (
    <NumberField
      label="Quantity"
      description="Whole packs."
      defaultValue={1}
      minValue={0}
      maxValue={20}
      step={1}
    />
  );
}
