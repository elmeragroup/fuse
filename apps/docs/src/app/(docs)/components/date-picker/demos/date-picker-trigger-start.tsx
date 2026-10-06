"use client";

import { CalendarDate } from "@internationalized/date";

import { DatePicker } from "@elmeragroup/fuse/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

/**
 * `triggerPlacement="start"` moves the calendar button ahead of the segments, so Tab
 * reaches it first. Clicking the label focuses the button too.
 */
export function DatePickerTriggerStart() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DatePicker label="Start date" defaultValue={new CalendarDate(2026, 7, 14)} triggerPlacement="start" />
    </UiProviders>
  );
}
