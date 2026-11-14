"use client";

import { DateRangePicker } from "@elmeragroup/fuse/date-range-picker";

export function DateRangePickerParts() {
  return (
    <DateRangePicker.Root
      defaultValue={{
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      }}>
      <DateRangePicker.Label>Stay</DateRangePicker.Label>
      <DateRangePicker.Group>
        <DateRangePicker.StartInput />
        <DateRangePicker.Separator />
        <DateRangePicker.EndInput />
        <DateRangePicker.Trigger className="ms-auto" />
      </DateRangePicker.Group>
      <DateRangePicker.Error />
      <DateRangePicker.Description>Check-in and check-out.</DateRangePicker.Description>
      <DateRangePicker.Popup>
        <DateRangePicker.Calendar />
      </DateRangePicker.Popup>
    </DateRangePicker.Root>
  );
}
