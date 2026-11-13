"use client";

import { useState } from "react";

import { Form } from "@elmeragroup/fuse/form";
import { TextField } from "@elmeragroup/fuse/text-field";

export function FormDemo() {
  const [status, setStatus] = useState("");
  return (
    <Form
      onFormSubmit={(values) => {
        setStatus(`Signed up as ${String(values.email)}.`);
      }}>
      <div className="flex flex-col gap-4">
        <TextField label="Email" name="email" isRequired />
        <button type="submit" className="self-start">
          Sign up
        </button>
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      </div>
    </Form>
  );
}
