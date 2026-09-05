"use client";

import { NumberField } from "@elmeragroup/ui/number-field";

export function NumberFieldError() {
  return (
    <NumberField
      label="Quantity"
      description="Must be at least 1."
      isInvalid
      errorMessage="Enter a quantity of 1 or more."
      minValue={1}
      defaultValue={0}
    />
  );
}
