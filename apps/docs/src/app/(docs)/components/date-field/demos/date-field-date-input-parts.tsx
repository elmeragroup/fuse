"use client";

import { DateInput } from "@elmeragroup/fuse/date-field";
import { Field } from "@elmeragroup/fuse/field";

export function DateFieldDateInputParts() {
  return (
    <Field.Root name="reading">
      <Field.Label>Reading date</Field.Label>
      <DateInput.Root defaultValue={Temporal.PlainDate.from("2026-10-05")}>
        {/* Each segment as the Root renders it by default. A host wraps or labels segments here. */}
        {(segment) => <DateInput.Segment key={segment.index} segment={segment} />}
      </DateInput.Root>
      <Field.Description>Read from the meter's display.</Field.Description>
      <Field.Error />
    </Field.Root>
  );
}
