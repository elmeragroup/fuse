"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { Switch } from "@elmeragroup/fuse/switch";

export function SwitchForm() {
  const [submitted, setSubmitted] = useState("");
  return (
    <form
      className="flex flex-col items-start gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(data.get("notifications") === "on" ? "on" : "off");
      }}>
      <Field.Root>
        <Field.Label>Notifications</Field.Label>
        <Switch name="notifications" value="on" defaultChecked />
      </Field.Root>
      <Button type="submit">Save</Button>
      <p role="status" className="text-sm">
        {submitted ? `Submitted: ${submitted}` : ""}
      </p>
    </form>
  );
}
