"use client";

import { CalendarDate } from "@internationalized/date";

import { DatePicker } from "@elmeragroup/fuse/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function DatePickerSizes() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-wrap items-start gap-3">
        <DatePicker size="sm" label="Small" defaultValue={new CalendarDate(2026, 7, 14)} />
        <DatePicker label="Default" defaultValue={new CalendarDate(2026, 7, 14)} />
      </div>
    </UiProviders>
  );
}
