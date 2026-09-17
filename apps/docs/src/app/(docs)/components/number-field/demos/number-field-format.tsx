"use client";

import { NumberField } from "@elmeragroup/ui/number-field";
import { ElmeraGroupUiProvider } from "@elmeragroup/ui/theme";

export function NumberFieldFormat() {
  return (
    <ElmeraGroupUiProvider locale="en-US">
      <div className="flex flex-col gap-3">
        <NumberField
          label="Price"
          defaultValue={249}
          formatOptions={{ style: "currency", currency: "NOK" }}
        />
        <NumberField
          label="Share"
          defaultValue={0.15}
          formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
        />
      </div>
    </ElmeraGroupUiProvider>
  );
}
