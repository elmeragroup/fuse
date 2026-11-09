"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { DatePickerField } from "@elmeragroup/fuse/date-picker";
import { Form } from "@elmeragroup/fuse/form";

type Errors = Record<string, string>;

// Stands in for a server action: it receives the picker's ISO text and returns errors keyed by
// the field's name, as React Aria's `validationErrors` did.
function validateOnServer(moving: string): Errors {
  const date = Temporal.PlainDate.from(moving);
  return date.dayOfWeek >= 6 ? { moving: "We do not move people on weekends." } : {};
}

export function ServerErrors() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  return (
    <Form
      className="max-w-xs w-full"
      errors={errors}
      onFormSubmit={(values) => {
        const moving = String(values.moving);
        const returned = validateOnServer(moving);
        setErrors(returned);
        setStatus(Object.keys(returned).length === 0 ? `Saved ${moving}.` : "");
      }}>
      {/* No isInvalid or errorMessage: the Form hands the error to the picker by its name. */}
      <DatePickerField<Temporal.PlainDate>
        label="Moving date"
        name="moving"
        description="Try Saturday, October 10, 2026."
        defaultValue="2026-10-10"
        isRequired
      />
      <Button type="submit" className="self-start">
        Save
      </Button>
      <output className="text-sm text-muted-foreground">{status}</output>
    </Form>
  );
}
