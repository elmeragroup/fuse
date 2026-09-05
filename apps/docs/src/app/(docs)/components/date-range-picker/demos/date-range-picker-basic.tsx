"use client";

import { CalendarDate } from "@internationalized/date";

import { DateRangePicker } from "@elmeragroup/ui/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function DateRangePickerBasic() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DateRangePicker
        label="Delivery window"
        description="The days we may deliver the order."
        defaultValue={{ start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 18) }}
      />
    </UiProviders>
  );
}
