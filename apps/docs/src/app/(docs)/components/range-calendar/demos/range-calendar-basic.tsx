"use client";

import { CalendarDate } from "@internationalized/date";

import { RangeCalendar } from "@elmeragroup/fuse/react-aria/range-calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function RangeCalendarBasic() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <RangeCalendar
        defaultValue={{ start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 18) }}
      />
    </UiProviders>
  );
}
