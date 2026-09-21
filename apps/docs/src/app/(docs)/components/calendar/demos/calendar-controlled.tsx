"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

import { Calendar } from "@elmeragroup/fuse/react-aria/calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function CalendarControlled() {
  const [value, setValue] = useState<DateValue | null>(new CalendarDate(2026, 7, 14));
  const [focusedValue, setFocusedValue] = useState<DateValue>(new CalendarDate(2026, 7, 14));

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <Calendar
        value={value}
        onChange={setValue}
        focusedValue={focusedValue}
        onFocusChange={setFocusedValue}
      />
    </UiProviders>
  );
}
