"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Form } from "@elmeragroup/fuse/form";
import { TextField } from "@elmeragroup/fuse/text-field";

export function FormValidateOnChange() {
  return (
    <Form
      validationMode="onChange"
      onFormSubmit={() => {
        // Handled here, so the submit stays on this page.
      }}>
      <div className="flex flex-col gap-4">
        <TextField label="Email" name="email" isRequired />
        <Button type="submit" className="self-start">
          Sign up
        </Button>
      </div>
    </Form>
  );
}
