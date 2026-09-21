"use client";

import { CalendarDate } from "@internationalized/date";
import { DateField, Label } from "react-aria-components";

import { DateInput } from "@elmeragroup/fuse/react-aria/date-field";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function DateFieldDateInput() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DateField defaultValue={new CalendarDate(2026, 7, 14)}>
        <Label>Start date</Label>
        <DateInput />
      </DateField>
    </UiProviders>
  );
}
