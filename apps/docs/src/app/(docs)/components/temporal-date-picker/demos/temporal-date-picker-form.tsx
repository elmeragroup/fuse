"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { DatePickerField } from "@elmeragroup/fuse/date-picker";
import { Form } from "@elmeragroup/fuse/form";

type Errors = Record<string, string>;

export function TemporalDatePickerForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  return (
    <Form
      className="max-w-xs w-full"
      errors={errors}
      onFormSubmit={(values) => {
        // Stands in for a server: the submitted value is the picker's ISO text.
        if (values.start === "2026-12-24") {
          setErrors({ start: "We are closed on Christmas Eve." });
          setStatus("");
          return;
        }
        setErrors({});
        setStatus(`Saved ${String(values.start)}.`);
      }}>
      <DatePickerField
        label="Start date"
        name="start"
        description="Try December 24, 2026."
        minValue={Temporal.PlainDate.from("2026-10-01")}
        isRequired
      />
      <Button type="submit" className="self-start">
        Save
      </Button>
      <output className="text-sm text-muted-foreground">{status}</output>
    </Form>
  );
}
