"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function PhoneNumberFieldForm() {
  const [submitted, setSubmitted] = useState("");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const phone = data.get("phone");
        const display = data.get("phone-display-value");
        setSubmitted(
          `phone=${phone instanceof File ? "" : (phone ?? "")} display=${display instanceof File ? "" : (display ?? "")}`
        );
      }}>
      <PhoneNumberField
        label="Mobile"
        name="phone"
        defaultValue="+4741234567"
        description="Starts from a saved number; Reset brings it back."
      />
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted ? <p>{submitted}</p> : null}
    </form>
  );
}
