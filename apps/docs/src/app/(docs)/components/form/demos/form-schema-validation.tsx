"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { TextField } from "@elmeragroup/fuse/text-field";

type Errors = { phone?: string };

// Stands in for a schema library or a server: the phone rule depends on the checkbox.
function validate(data: FormData): Errors {
  const phone = String(data.get("phone") ?? "");
  if (data.get("no-phone") === null && !/^\d{8}$/.test(phone)) {
    return { phone: "Enter eight digits, or tick that you have no mobile number." };
  }
  return {};
}

export function FormSchemaValidation() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate(new FormData(event.currentTarget));
    setErrors(next);
    setStatus(next.phone === undefined ? "Saved." : "");
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        label="Mobile number"
        name="phone"
        filter="numeric"
        isInvalid={errors.phone !== undefined}
        errorMessage={errors.phone}
      />
      <Field.Root orientation="horizontal">
        <Checkbox name="no-phone" />
        <Field.Label>I have no mobile number</Field.Label>
      </Field.Root>
      <Button type="submit" className="self-start">
        Save
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
    </form>
  );
}
