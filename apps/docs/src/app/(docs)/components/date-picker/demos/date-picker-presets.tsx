"use client";

import { useState } from "react";

import { getLocalTimeZone, today } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";

import {
  DatePicker,
  DatePickerPresetGroup,
  DatePickerPresetItem,
} from "@elmeragroup/ui/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

/**
 * Presets are radios: one shortcut is in effect at a time. Their visible copy is their
 * accessible name, and the group's own name comes from the locale dictionary. Double-clicking
 * "In a week" also dismisses the dialog — a pointer shortcut on top of the single click.
 */
export function DatePickerPresets() {
  const [value, setValue] = useState<CalendarDate | null>(null);
  const [preset, setPreset] = useState<string | null>(null);

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DatePicker<CalendarDate>
        label="Delivery date"
        value={value}
        onChange={(next) => {
          setValue(next);
          setPreset(null);
        }}
        presetGroup={
          <DatePickerPresetGroup
            value={preset}
            onChange={(next) => {
              setPreset(next);
              setValue(today(getLocalTimeZone()).add({ days: next === "in-a-week" ? 7 : 0 }));
            }}>
            <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
            <DatePickerPresetItem value="in-a-week" isCloseDialogOnDoubleClick>
              In a week
            </DatePickerPresetItem>
          </DatePickerPresetGroup>
        }
      />
    </UiProviders>
  );
}
