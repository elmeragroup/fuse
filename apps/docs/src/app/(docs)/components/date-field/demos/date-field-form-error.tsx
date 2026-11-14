"use client";

import { DateField } from "@elmeragroup/fuse/date-field";
import { Form } from "@elmeragroup/fuse/form";

export function DateFieldFormError() {
  return (
    <Form errors={{ start: "We are closed on Christmas Eve." }}>
      <DateField label="Start date" name="start" defaultValue={Temporal.PlainDate.from("2026-12-24")} />
    </Form>
  );
}
