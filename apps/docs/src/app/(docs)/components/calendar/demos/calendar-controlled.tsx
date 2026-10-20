"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

import { Calendar } from "@elmeragroup/fuse/react-aria/calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

const initialDate = new CalendarDate(2026, 7, 14);

export function CalendarControlled() {
  const [value, setValue] = useState<DateValue | null>(initialDate);
  const [focusedValue, setFocusedValue] = useState<DateValue>(initialDate);

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
