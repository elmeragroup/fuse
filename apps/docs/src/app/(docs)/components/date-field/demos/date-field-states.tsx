"use client";

import { DateField } from "@elmeragroup/fuse/date-field";

export function DateFieldStates() {
  const date = Temporal.PlainDate.from("2026-10-05");
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DateField label="Small" size="sm" defaultValue={date} />
      <DateField label="Default" defaultValue={date} />
      <DateField
        label="Moving date"
        defaultValue={date}
        isInvalid
        errorMessage="Choose a date after the lease ends."
      />
      <DateField label="Inspection" defaultValue={date} isDisabled />
      <DateField label="Contract start" defaultValue={date} isReadOnly />
    </div>
  );
}
