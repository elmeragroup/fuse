"use client";

import { useState } from "react";

import { CalendarDate, isWeekend } from "@internationalized/date";

import { Field } from "@elmeragroup/fuse/field";
import { RangeCalendar } from "@elmeragroup/fuse/react-aria/range-calendar";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { Switch } from "@elmeragroup/fuse/switch";

export function RangeCalendarUnavailable() {
  const [allowsNonContiguousRanges, setAllowsNonContiguousRanges] = useState(false);

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-4">
        <Field.Root>
          <Field.Label>Allow ranges that skip weekends</Field.Label>
          <Switch checked={allowsNonContiguousRanges} onCheckedChange={setAllowsNonContiguousRanges} />
        </Field.Root>
        <RangeCalendar
          defaultFocusedValue={new CalendarDate(2026, 7, 14)}
          isDateUnavailable={(date) => isWeekend(date, "en-US")}
          allowsNonContiguousRanges={allowsNonContiguousRanges}
        />
      </div>
    </UiProviders>
  );
}
