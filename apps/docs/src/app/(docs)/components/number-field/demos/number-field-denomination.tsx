"use client";

import { NumberField } from "@elmeragroup/ui/number-field";

export function NumberFieldDenomination() {
  return <NumberField label="Energy" denomination="kWh" minValue={0} defaultValue={12} />;
}
