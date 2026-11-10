"use client";

import { useState } from "react";

import { DatePicker } from "@elmeragroup/fuse/date-picker";
import { Field } from "@elmeragroup/fuse/field";

export function TemporalDatePickerControlled() {
  const [value, setValue] = useState<Temporal.PlainDate | null>(null);
  const [note, setNote] = useState("Weekends are refused.");
  return (
    <Field.Root className="max-w-xs w-full">
      <Field.Label>Delivery</Field.Label>
      <DatePicker.Root
        value={value}
        onValueChange={(next, details) => {
          // Canceling keeps the value; a refused day keeps the popup open on it.
          if (next !== null && next.dayOfWeek > 5) {
            details.cancel();
            setNote(
              `No deliveries on ${next.toLocaleString("en-US", { weekday: "long" })}s (${details.reason}).`
            );
            return;
          }
          setValue(next);
          setNote(next === null ? "Cleared." : `Delivery on ${next.toString()} (${details.reason}).`);
        }}>
        <DatePicker.Group>
          <DatePicker.Input />
          <DatePicker.Trigger />
        </DatePicker.Group>
        <DatePicker.Popup>
          <DatePicker.Calendar />
        </DatePicker.Popup>
      </DatePicker.Root>
      <Field.Description>{note}</Field.Description>
    </Field.Root>
  );
}
