"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { DatePickerField } from "@elmeragroup/fuse/date-picker";
import { Form } from "@elmeragroup/fuse/form";
import type { FormProps } from "@elmeragroup/fuse/form";
import { TextField } from "@elmeragroup/fuse/text-field";

export function FormServerErrors() {
  const [errors, setErrors] = useState<FormProps["errors"]>({});
  return (
    <Form
      errors={errors}
      onFormSubmit={() => {
        // A server action would answer here. This one rejects every submit.
        setErrors({
          email: "This address is already registered.",
          phone: ["Enter eight digits.", "Use a Norwegian mobile number."],
          startDate: "We cannot connect you before the first of next month.",
        });
      }}>
      <div className="flex flex-col gap-4">
        <TextField label="Email" name="email" defaultValue="ada@example.com" />
        <TextField label="Mobile number" name="phone" filter="numeric" defaultValue="1234" />
        <DatePickerField
          label="Start date"
          name="startDate"
          defaultValue={Temporal.PlainDate.from("2026-07-14")}
        />
        <Button type="submit">Sign up</Button>
      </div>
    </Form>
  );
}
