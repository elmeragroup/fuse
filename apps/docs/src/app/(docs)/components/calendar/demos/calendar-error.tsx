"use client";

import { CalendarDate } from "@internationalized/date";

import { Calendar } from "@elmeragroup/fuse/react-aria/calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function CalendarError() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <Calendar
        defaultValue={new CalendarDate(2026, 7, 14)}
        isInvalid
        errorMessage={<span>That day is closed.</span>}
      />
    </UiProviders>
  );
}
