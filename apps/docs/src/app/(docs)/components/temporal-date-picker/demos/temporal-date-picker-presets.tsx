"use client";

import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";

export function TemporalDatePickerPresets() {
  return (
    <DatePickerField
      className="max-w-xs w-full"
      label="Start date"
      defaultValue={Temporal.PlainDate.from("2026-10-05")}
      presetGroup={
        <DatePicker.Presets>
          <DatePicker.PresetItem
            value="next-monday"
            dateValue={Temporal.PlainDate.from("2026-10-12")}
            closeOnDoubleClick>
            Next Monday
          </DatePicker.PresetItem>
          <DatePicker.PresetItem
            value="first-of-month"
            dateValue={Temporal.PlainDate.from("2026-11-01")}
            closeOnDoubleClick>
            First of next month
          </DatePicker.PresetItem>
          <DatePicker.PresetItem value="new-year" dateValue={Temporal.PlainDate.from("2027-01-01")} disabled>
            New Year (closed)
          </DatePicker.PresetItem>
        </DatePicker.Presets>
      }
    />
  );
}
