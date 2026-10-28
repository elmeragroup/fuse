"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";

export function NumberFieldSizes() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <NumberField size="sm" label="Small" defaultValue={2} minValue={0} className="w-40" />
      <NumberField label="Default" defaultValue={2} minValue={0} className="w-40" />
    </div>
  );
}
