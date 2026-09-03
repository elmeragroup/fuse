"use client";

import { useState } from "react";

import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";

export function FieldErrorDemo() {
  const [email, setEmail] = useState("ada");
  const isInvalid = !email.includes("@");

  return (
    <Field.Root invalid={isInvalid}>
      <Field.Label>Email</Field.Label>
      <Input
        type="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      <Field.Description>Validation lives outside the field; the message is passed in.</Field.Description>
      <Field.Error>{isInvalid ? "Enter a work email." : null}</Field.Error>
    </Field.Root>
  );
}
