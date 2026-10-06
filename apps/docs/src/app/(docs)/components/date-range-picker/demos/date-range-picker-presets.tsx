"use client";

import { useState } from "react";

import { getLocalTimeZone, startOfMonth, today } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

import {
  DateRangePicker,
  DateRangePickerPresetGroup,
  DateRangePickerPresetItem,
} from "@elmeragroup/fuse/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

type Range = { start: DateValue; end: DateValue };

/** The caller owns what each preset means; the picker only reports which one was chosen. */
function rangeFor(preset: string): Range {
  const now = today(getLocalTimeZone());
  if (preset === "last-7-days") {
    return { start: now.subtract({ days: 6 }), end: now };
  }
  if (preset === "this-month") {
    return { start: startOfMonth(now), end: now };
  }
  return { start: now, end: now };
}

/**
 * Presets are radios: one shortcut is in effect at a time. Their visible copy is their
 * accessible name, and the group's own name comes from the locale dictionary. Editing the
 * dates by hand clears the chosen preset. Double-clicking "This month" also dismisses the
 * dialog.
 */
export function DateRangePickerPresets() {
  const [value, setValue] = useState<Range | null>(null);
  const [preset, setPreset] = useState<string | null>(null);

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DateRangePicker
        label="Period"
        value={value}
        onChange={(next) => {
          setValue(next);
          setPreset(null);
        }}
        presetGroup={
          <DateRangePickerPresetGroup
            value={preset}
            onChange={(next) => {
              setPreset(next);
              setValue(rangeFor(next));
            }}>
            <DateRangePickerPresetItem value="today">Today</DateRangePickerPresetItem>
            <DateRangePickerPresetItem value="last-7-days">Last 7 days</DateRangePickerPresetItem>
            <DateRangePickerPresetItem value="this-month" isCloseDialogOnDoubleClick>
              This month
            </DateRangePickerPresetItem>
          </DateRangePickerPresetGroup>
        }
      />
    </UiProviders>
  );
}
