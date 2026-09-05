"use client";

import { CalendarDate } from "@internationalized/date";

import { RangeCalendar } from "@elmeragroup/ui/react-aria/range-calendar";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function RangeCalendarBounds() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <RangeCalendar
        defaultValue={{ start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 18) }}
        minValue={new CalendarDate(2026, 7, 6)}
        maxValue={new CalendarDate(2026, 7, 24)}
      />
    </UiProviders>
  );
}
