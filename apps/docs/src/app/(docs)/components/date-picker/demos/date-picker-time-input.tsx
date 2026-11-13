"use client";

import { DatePicker } from "@elmeragroup/fuse/date-picker";
import { Field } from "@elmeragroup/fuse/field";

export function DatePickerTimeInput() {
  return (
    <Field.Root className="max-w-xs w-full">
      <Field.Label>Meeting starts</Field.Label>
      <DatePicker.Root granularity="minute" hourCycle={24} shouldCloseOnSelect={false}>
        <DatePicker.Group>
          <DatePicker.Input />
          <DatePicker.Trigger />
        </DatePicker.Group>
        <DatePicker.Popup>
          <DatePicker.Calendar />
          <DatePicker.TimeInput />
        </DatePicker.Popup>
      </DatePicker.Root>
    </Field.Root>
  );
}
