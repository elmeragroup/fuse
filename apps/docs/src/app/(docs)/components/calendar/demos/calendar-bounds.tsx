"use client";

import { CalendarDate, isWeekend } from "@internationalized/date";

import { Calendar } from "@elmeragroup/fuse/react-aria/calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function CalendarBounds() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <Calendar
        defaultValue={new CalendarDate(2026, 7, 14)}
        minValue={new CalendarDate(2026, 7, 1)}
        maxValue={new CalendarDate(2026, 7, 31)}
        isDateUnavailable={(date) => isWeekend(date, "en-US")}
      />
    </UiProviders>
  );
}
