"use client";

import { CalendarDate } from "@internationalized/date";

import { DateField } from "@elmeragroup/fuse/react-aria/date-field";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function DateFieldSizes() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-wrap items-start gap-3">
        <DateField size="sm" label="Small" defaultValue={new CalendarDate(2026, 7, 14)} />
        <DateField label="Default" defaultValue={new CalendarDate(2026, 7, 14)} />
      </div>
    </UiProviders>
  );
}
