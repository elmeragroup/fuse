"use client";

import { CalendarDate } from "@internationalized/date";

import { Calendar } from "@elmeragroup/ui/react-aria/calendar";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function CalendarBasic() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <Calendar defaultValue={new CalendarDate(2026, 7, 14)} />
    </UiProviders>
  );
}
