"use client";

import { useState } from "react";

import { DateRangePicker, DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
import type { DateRangePickerValue } from "@elmeragroup/fuse/date-range-picker";

const PRESETS = {
  "this-week": ["2026-10-05", "2026-10-11"],
  "next-week": ["2026-10-12", "2026-10-18"],
  october: ["2026-10-01", "2026-10-31"],
} as const;

type Preset = keyof typeof PRESETS;

function isPreset(value: string): value is Preset {
  return Object.hasOwn(PRESETS, value);
}

/** A preset's range, built when it is picked, so the page's Temporal polyfill is installed by then. */
function presetRange(preset: Preset): DateRangePickerValue {
  const [start, end] = PRESETS[preset];
  return { start: Temporal.PlainDate.from(start), end: Temporal.PlainDate.from(end) };
}

export function TemporalRangePickerPresets() {
  const [value, setValue] = useState<DateRangePickerValue | null>(() => presetRange("this-week"));
  const [preset, setPreset] = useState<Preset | null>("this-week");
  return (
    <DateRangePickerField
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
            setValue(presetRange(next));
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
