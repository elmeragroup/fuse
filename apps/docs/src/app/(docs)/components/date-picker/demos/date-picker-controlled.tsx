"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";

import { DatePicker } from "@elmeragroup/fuse/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { Text } from "@elmeragroup/fuse/text";

const initialValue = new CalendarDate(2026, 7, 14);

export function DatePickerControlled() {
  const [value, setValue] = useState<CalendarDate | null>(initialValue);

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-col gap-2">
        <DatePicker<CalendarDate> label="Invoice date" value={value} onChange={setValue} />
        <Text size="sm" variant="muted">
          {value === null ? "No date selected." : value.toString()}
        </Text>
      </div>
    </UiProviders>
  );
}
