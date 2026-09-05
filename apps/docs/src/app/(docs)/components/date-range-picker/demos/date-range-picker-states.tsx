"use client";

import { CalendarDate } from "@internationalized/date";

import { DateRangePicker } from "@elmeragroup/ui/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

const deliveryWindow = { start: new CalendarDate(2026, 7, 14), end: new CalendarDate(2026, 7, 18) };

export function DateRangePickerStates() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-3">
        <DateRangePicker label="Disabled" isDisabled defaultValue={deliveryWindow} />
        <DateRangePicker label="Read only" isReadOnly defaultValue={deliveryWindow} />
        <DateRangePicker label="Required" isRequired defaultValue={deliveryWindow} />
      </div>
    </UiProviders>
  );
}
