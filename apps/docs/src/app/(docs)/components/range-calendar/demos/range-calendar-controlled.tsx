"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

import { RangeCalendar } from "@elmeragroup/fuse/react-aria/range-calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { Text } from "@elmeragroup/fuse/text";

type Range = { start: DateValue; end: DateValue };

export function RangeCalendarControlled() {
  const [value, setValue] = useState<Range | null>({
    start: new CalendarDate(2026, 7, 14),
    end: new CalendarDate(2026, 7, 18),
  });

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-2">
        <RangeCalendar value={value} onChange={setValue} />
        <Text size="sm" variant="muted">
          {value === null ? "No range selected." : `${value.start.toString()} — ${value.end.toString()}`}
        </Text>
      </div>
    </UiProviders>
  );
}
