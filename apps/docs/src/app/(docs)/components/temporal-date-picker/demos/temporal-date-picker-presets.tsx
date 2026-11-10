"use client";

import { useState } from "react";

import { DatePicker, DatePickerField } from "@elmeragroup/fuse/date-picker";

const PRESETS = {
  "next-monday": "2026-10-12",
  "first-of-month": "2026-11-01",
  "new-year": "2027-01-01",
} as const;

type Preset = keyof typeof PRESETS;

function isPreset(value: string): value is Preset {
  return Object.hasOwn(PRESETS, value);
}

export function TemporalDatePickerPresets() {
  const [value, setValue] = useState<Temporal.PlainDate | string | null>("2026-10-05");
  const [preset, setPreset] = useState<Preset | null>(null);
  return (
    <DatePickerField<Temporal.PlainDate>
      className="max-w-xs w-full"
      label="Start date"
      value={value}
      onChange={(next) => {
        setValue(next);
        setPreset(null);
      }}
      presetGroup={
        <DatePicker.Presets
          value={preset}
          onValueChange={(next) => {
            if (!isPreset(next)) return;
            setPreset(next);
            setValue(PRESETS[next]);
          }}>
          <DatePicker.PresetItem value="next-monday" closeOnDoubleClick>
            Next Monday
          </DatePicker.PresetItem>
          <DatePicker.PresetItem value="first-of-month" closeOnDoubleClick>
            First of next month
          </DatePicker.PresetItem>
          <DatePicker.PresetItem value="new-year" disabled>
            New Year (closed)
          </DatePicker.PresetItem>
        </DatePicker.Presets>
      }
    />
  );
}
