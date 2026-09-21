"use client";

import { CalendarDate } from "@internationalized/date";

import { DateField } from "@elmeragroup/fuse/react-aria/date-field";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function DateFieldBasic() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DateField
        label="Invoice date"
        description="The date printed on the invoice."
        defaultValue={new CalendarDate(2026, 7, 14)}
      />
    </UiProviders>
  );
}
