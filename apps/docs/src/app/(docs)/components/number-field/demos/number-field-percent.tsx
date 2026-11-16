"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldPercent() {
  return (
    <NumberField
      label="Share"
      defaultValue={0.15}
      formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
    />
  );
}
