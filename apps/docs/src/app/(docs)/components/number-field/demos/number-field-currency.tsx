"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldCurrency() {
  return (
    <NumberField label="Price" defaultValue={249} formatOptions={{ style: "currency", currency: "NOK" }} />
  );
}
