"use client";

import { CalendarDate, isWeekend } from "@internationalized/date";

import { RangeCalendar } from "@elmeragroup/fuse/react-aria/range-calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

/**
 * The range starts on a Saturday while weekends are unavailable, so RAC marks the
 * calendar invalid and the errorMessage explains why.
 */
export function RangeCalendarError() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <RangeCalendar
        defaultValue={{ start: new CalendarDate(2026, 7, 18), end: new CalendarDate(2026, 7, 22) }}
        isDateUnavailable={(date) => isWeekend(date, "en-US")}
        errorMessage="Delivery ranges have to start and end on a weekday."
      />
    </UiProviders>
  );
}
