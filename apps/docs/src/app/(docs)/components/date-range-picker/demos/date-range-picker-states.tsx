"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerStates() {
  const stay = {
    start: Temporal.PlainDate.from("2026-10-05"),
    end: Temporal.PlainDate.from("2026-10-09"),
  };
  return (
    <div className="max-w-md flex w-full flex-col gap-4">
      <DateRangePickerField label="Small" size="sm" defaultValue={stay} />
      <DateRangePickerField label="Default" defaultValue={stay} />
      <DateRangePickerField
        label="Stay"
        defaultValue={stay}
        isInvalid
        errorMessage="The cabin is booked on these nights."
      />
      <DateRangePickerField label="Maintenance window" defaultValue={stay} isDisabled />
      <DateRangePickerField label="Lease" defaultValue={stay} isReadOnly />
    </div>
  );
}
