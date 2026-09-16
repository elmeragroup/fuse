"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

import { DateRangePicker } from "@elmeragroup/ui/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";
import { Text } from "@elmeragroup/ui/text";

type Range = { start: DateValue; end: DateValue };

/** `onChange` reports whole ranges only — editing one row alone reports nothing. */
export function DateRangePickerControlled() {
  const [value, setValue] = useState<Range | null>({
    start: new CalendarDate(2026, 7, 14),
    end: new CalendarDate(2026, 7, 18),
  });

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <DateRangePicker label="Delivery window" value={value} onChange={setValue} />
        <Text size="sm" variant="muted">
          {value === null ? "No range selected." : `${value.start.toString()} — ${value.end.toString()}`}
        </Text>
      </div>
    </UiProviders>
  );
}
