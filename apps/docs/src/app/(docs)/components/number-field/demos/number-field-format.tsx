"use client";

import { NumberField } from "@elmeragroup/ui/number-field";

export function NumberFieldFormat() {
  return (
    <div className="flex flex-col gap-3">
      <NumberField
        label="Price"
        denomination="kr"
        defaultValue={249}
        formatOptions={{ style: "currency", currency: "NOK" }}
      />
      <NumberField
        label="Share"
        defaultValue={0.15}
        formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
      />
    </div>
  );
}
