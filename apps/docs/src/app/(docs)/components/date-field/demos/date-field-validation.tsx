"use client";

import { useState } from "react";

import { CalendarDate } from "@internationalized/date";

import { DateField } from "@elmeragroup/ui/react-aria/date-field";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

const minValue = new CalendarDate(2026, 7, 1);
const maxValue = new CalendarDate(2026, 12, 31);

export function DateFieldValidation() {
  const [value, setValue] = useState(new CalendarDate(2026, 1, 1));
  const isOutOfRange = value.compare(minValue) < 0 || value.compare(maxValue) > 0;

  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <DateField<CalendarDate>
        label="Invoice date"
        description="Must fall in the second half of 2026."
        value={value}
        onChange={(next) => {
          if (next !== null) {
            setValue(next);
          }
        }}
        minValue={minValue}
        maxValue={maxValue}
        isInvalid={isOutOfRange}
        errorMessage={(result) =>
          result.validationErrors.length > 0 ? result.validationErrors.join(" ") : "Pick a date in range."
        }
      />
    </UiProviders>
  );
}
