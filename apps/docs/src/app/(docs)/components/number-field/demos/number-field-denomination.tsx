"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldDenomination() {
  return <NumberField label="Energy in kWh" denomination="kWh" defaultValue={12} minValue={0} />;
}
