"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";

export function DatePickerStates() {
  const date = Temporal.PlainDate.from("2026-10-05");
  return (
    <div className="max-w-xs flex w-full flex-col gap-4">
      <DatePickerField label="Small" size="sm" defaultValue={date} />
      <DatePickerField label="Default" defaultValue={date} />
      <DatePickerField
        label="Moving date"
        defaultValue={date}
        isInvalid
        errorMessage="Choose a date after the lease ends."
      />
      <DatePickerField label="Inspection" defaultValue={date} isDisabled />
      <DatePickerField label="Contract start" defaultValue={date} isReadOnly />
    </div>
  );
}
