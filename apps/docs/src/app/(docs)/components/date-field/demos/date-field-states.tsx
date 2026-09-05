"use client";

import { CalendarDate } from "@internationalized/date";

import { DateField } from "@elmeragroup/ui/react-aria/date-field";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

export function DateFieldStates() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-3">
        <DateField label="Disabled" isDisabled defaultValue={new CalendarDate(2026, 7, 14)} />
        <DateField label="Read only" isReadOnly defaultValue={new CalendarDate(2026, 7, 14)} />
        <DateField label="Required" isRequired defaultValue={new CalendarDate(2026, 7, 14)} />
      </div>
    </UiProviders>
  );
}
