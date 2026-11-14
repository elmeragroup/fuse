"use client";

import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
import { Form } from "@elmeragroup/fuse/form";

export function DateRangePickerFormError() {
  return (
    <Form errors={{ checkOut: "No check-outs on Fridays." }}>
      <DateRangePickerField
        label="Stay"
        startName="checkIn"
        endName="checkOut"
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    </Form>
  );
}
