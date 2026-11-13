"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { DateRangePickerField } from "@elmeragroup/fuse/date-range-picker";
import { Form } from "@elmeragroup/fuse/form";

type Errors = Record<string, string>;

export function DateRangePickerForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  return (
    <Form
      className="max-w-md w-full"
      errors={errors}
      onFormSubmit={(values) => {
        // Stands in for a server: each end submits its ISO text under its own name.
        const checkOut = Temporal.PlainDate.from(String(values.checkOut));
        if (checkOut.dayOfWeek === 5) {
          setErrors({ checkOut: "No check-outs on Fridays." });
          setStatus("");
          return;
        }
        setErrors({});
        setStatus(`Booked ${String(values.checkIn)} to ${String(values.checkOut)}.`);
      }}>
      <DateRangePickerField
        label="Stay"
        startName="checkIn"
        endName="checkOut"
        description="A Friday check-out comes back with an error on the end."
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        isRequired
      />
      <Button type="submit" className="self-start">
        Book
      </Button>
      <output className="text-sm text-muted-foreground">{status}</output>
    </Form>
  );
}
