"use client";

import { CalendarDate, CalendarDateTime } from "@internationalized/date";

import { DateField } from "@elmeragroup/ui/react-aria/date-field";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function DateFieldGranularity() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-3">
        <DateField label="Invoice date" defaultValue={new CalendarDate(2026, 7, 14)} />
        <DateField
          label="Appointment"
          granularity="hour"
          hourCycle={24}
          defaultValue={new CalendarDateTime(2026, 7, 14, 15)}
        />
      </div>
    </UiProviders>
  );
}
