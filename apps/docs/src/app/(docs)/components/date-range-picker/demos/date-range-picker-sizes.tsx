"use client";

import { CalendarDate } from "@internationalized/date";

import { DateRangePicker } from "@elmeragroup/fuse/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

const week = { start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 18) };

export function DateRangePickerSizes() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-3">
        <DateRangePicker size="sm" label="Small" defaultValue={week} className="w-96 max-w-full" />
        <DateRangePicker label="Default" defaultValue={week} className="w-96 max-w-full" />
      </div>
    </UiProviders>
  );
}
