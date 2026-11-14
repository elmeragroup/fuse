"use client";

import { DatePickerField } from "@elmeragroup/fuse/date-picker";
import { Form } from "@elmeragroup/fuse/form";

export function DatePickerFormError() {
  return (
    <Form errors={{ start: "We are closed on Christmas Eve." }}>
      <DatePickerField label="Start date" name="start" defaultValue={Temporal.PlainDate.from("2026-12-24")} />
    </Form>
  );
}
