"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Form } from "@elmeragroup/fuse/form";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldForm() {
  const [submitted, setSubmitted] = useState("");
  return (
    <Form<{ phone: string }>
      onFormSubmit={(values) => {
        setSubmitted(`phone=${values.phone}`);
      }}>
      <div className="flex flex-col gap-4">
        <PhoneNumberField
          label="Mobile"
          name="phone"
          defaultValue="+4741234567"
          description="Starts from a saved number; Reset brings it back. Save submits it in E.164."
        />
        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </div>
        {submitted ? <p>{submitted}</p> : null}
      </div>
    </Form>
  );
}
