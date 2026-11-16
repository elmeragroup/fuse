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
        const phone = event.currentTarget.elements.namedItem("phone");
        setSubmitted(phone instanceof HTMLInputElement ? `phone=${phone.value}` : "");
      }}
      onReset={() => {
        setSubmitted("");
      }}>
      <PhoneNumberField label="Mobile" name="phone" defaultValue="+4741234567" />
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {submitted}
      </p>
    </form>
  );
}
