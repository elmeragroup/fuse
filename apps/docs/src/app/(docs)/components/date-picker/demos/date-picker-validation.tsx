"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";

import { DatePicker } from "@elmeragroup/ui/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

const minValue = new CalendarDate(2026, 7, 1);

/** Starts out of range so the function `errorMessage` has a `ValidationResult` to render. */
export function DatePickerValidation() {
  const [value, setValue] = useState<CalendarDate | null>(new CalendarDate(2026, 1, 1));

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DatePicker<CalendarDate>
        label="Invoice date"
        description="Must fall in the second half of 2026."
        value={value}
        onChange={setValue}
        minValue={minValue}
        validationBehavior="aria"
        errorMessage={(result) =>
          result.validationDetails.rangeUnderflow
            ? "Pick a date on or after 1 July 2026."
            : "Enter a valid invoice date."
        }
      />
    </UiProviders>
  );
}
