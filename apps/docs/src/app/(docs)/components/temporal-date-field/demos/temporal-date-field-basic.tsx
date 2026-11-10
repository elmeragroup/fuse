"use client";

import { useState } from "react";

import { DateField } from "@elmeragroup/fuse/date-field";

export function TemporalDateFieldBasic() {
  const [value, setValue] = useState<Temporal.PlainDate | null>(null);
  return (
    <div className="max-w-xs flex w-full flex-col gap-2">
      <DateField
        label="Moving date"
        description="The day the keys change hands."
        value={value}
        onChange={setValue}
      />
      <output className="text-sm text-muted-foreground">Value: {value?.toString() ?? "none"}</output>
    </div>
  );
}
