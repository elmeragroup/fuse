"use client";

import { NumberField } from "@elmeragroup/fuse/number-field";
import { LocaleProvider } from "@elmeragroup/fuse/theme";

export function NumberFieldFormat() {
  return (
    <LocaleProvider locale="en-US">
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
    </LocaleProvider>
  );
}
