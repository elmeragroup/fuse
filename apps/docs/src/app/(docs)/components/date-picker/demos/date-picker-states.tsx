"use client";

import { CalendarDate } from "@internationalized/date";

import { DatePicker } from "@elmeragroup/fuse/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

const invoiceDate = new CalendarDate(2026, 7, 14);

export function DatePickerStates() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-3">
        <DatePicker label="Disabled" isDisabled defaultValue={invoiceDate} />
        <DatePicker label="Read only" isReadOnly defaultValue={invoiceDate} />
        <DatePicker label="Required" isRequired defaultValue={invoiceDate} />
      </div>
    </UiProviders>
  );
}
