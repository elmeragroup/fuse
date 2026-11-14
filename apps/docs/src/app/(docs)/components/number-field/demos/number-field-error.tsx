"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldError() {
  return (
    <NumberField
      label="Quantity"
      defaultValue={0}
      minValue={0}
      isInvalid
      errorMessage="Enter a quantity of 1 or more."
    />
  );
}
