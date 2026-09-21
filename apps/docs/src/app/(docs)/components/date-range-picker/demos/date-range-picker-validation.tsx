"use client";

import { useState } from "react";

import { CalendarDate, isWeekend } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

import { DateRangePicker } from "@elmeragroup/fuse/react-aria/date-range-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

type Range = { start: DateValue; end: DateValue };

const minValue = new CalendarDate(2026, 7, 1);
const maxValue = new CalendarDate(2026, 7, 31);

/**
 * Starts on a weekend, which is unavailable — so the function `errorMessage` has a real
 * `ValidationResult` to render rather than a permanent placeholder.
 */
export function DateRangePickerValidation() {
  const [value, setValue] = useState<Range | null>({
    start: new CalendarDate(2026, 7, 11),
    end: new CalendarDate(2026, 7, 15),
  });

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DateRangePicker
        label="Delivery window"
        description="Weekdays in July 2026 only."
        value={value}
        onChange={setValue}
        minValue={minValue}
        maxValue={maxValue}
        isDateUnavailable={(date) => isWeekend(date, "en-US")}
        validationBehavior="aria"
        errorMessage={(result) =>
          result.validationErrors.length > 0
            ? result.validationErrors.join(" ")
            : "Pick a weekday range inside July 2026."
        }
      />
    </UiProviders>
  );
}
