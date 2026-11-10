"use client";

import { DateInput } from "@elmeragroup/fuse/date-field";
import { Field } from "@elmeragroup/fuse/field";

export function TemporalDateFieldParts() {
  return (
    <Field.Root name="reading" className="max-w-xs w-full">
      <Field.Label>Reading date</Field.Label>
      <DateInput.Root size="sm" shouldForceLeadingZeros defaultValue={Temporal.PlainDate.from("2026-10-05")}>
        {/* Each segment, as DateInput.Root would render it; a function child is where a host
            wraps or labels segments itself. */}
        {(segment) => <DateInput.Segment key={segment.index} segment={segment} />}
      </DateInput.Root>
      <Field.Description>Read from the meter's display.</Field.Description>
      <Field.Error />
    </Field.Root>
  );
}
