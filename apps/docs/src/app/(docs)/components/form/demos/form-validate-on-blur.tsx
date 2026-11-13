"use client";

import { Form } from "@elmeragroup/fuse/form";
import { TextField } from "@elmeragroup/fuse/text-field";

export function FormValidateOnBlur() {
  return (
    <Form
      validationMode="onBlur"
      onFormSubmit={() => {
        // Handled here, so the submit stays on this page.
      }}>
      <div className="flex flex-col gap-4">
        <TextField label="Email" name="email" isRequired />
        <button type="submit" className="self-start">
          Sign up
        </button>
      </div>
    </Form>
  );
}
