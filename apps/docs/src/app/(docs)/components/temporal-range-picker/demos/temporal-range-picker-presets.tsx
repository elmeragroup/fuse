"use client";

import { useState } from "react";

import { DateRangePicker, DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";

const PRESETS = {
  "this-week": { start: "2026-10-05", end: "2026-10-11" },
  "next-week": { start: "2026-10-12", end: "2026-10-18" },
  october: { start: "2026-10-01", end: "2026-10-31" },
} as const;

type Preset = keyof typeof PRESETS;

function isPreset(value: string): value is Preset {
  return Object.hasOwn(PRESETS, value);
}

type Range = { readonly start: Temporal.PlainDate | string; readonly end: Temporal.PlainDate | string };

export function TemporalRangePickerPresets() {
  const [value, setValue] = useState<Range | null>(PRESETS["this-week"]);
  const [preset, setPreset] = useState<Preset | null>("this-week");
  return (
    <DateRangePickerField<Temporal.PlainDate>
      className="max-w-md"
      label="Report period"
      hourCycle={24}
      firstDayOfWeek="mon"
      size="sm"
      value={value}
      onChange={(next) => {
        setValue(next);
        setPreset(null);
      }}
      presetGroup={
        <DateRangePicker.Presets
          value={preset}
          onValueChange={(next) => {
            if (!isPreset(next)) return;
            setPreset(next);
            setValue(PRESETS[next]);
          }}>
          <DateRangePicker.PresetItem value="this-week" closeOnDoubleClick>
            This week
          </DateRangePicker.PresetItem>
          <DateRangePicker.PresetItem value="next-week" closeOnDoubleClick>
            Next week
          </DateRangePicker.PresetItem>
          <DateRangePicker.PresetItem value="october" closeOnDoubleClick>
            October
          </DateRangePicker.PresetItem>
        </DateRangePicker.Presets>
      }
    />
  );
}
