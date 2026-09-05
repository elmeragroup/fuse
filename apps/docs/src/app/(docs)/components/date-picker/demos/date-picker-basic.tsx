"use client";

import { CalendarDate } from "@internationalized/date";

import { DatePicker } from "@elmeragroup/ui/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function DatePickerBasic() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DatePicker
        label="Invoice date"
        description="The date printed on the invoice."
        defaultValue={new CalendarDate(2026, 7, 14)}
      />
    </UiProviders>
  );
}
