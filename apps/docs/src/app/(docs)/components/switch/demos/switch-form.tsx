"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Field } from "@elmeragroup/ui/field";
import { Switch } from "@elmeragroup/ui/switch";

export function SwitchForm() {
  const [submitted, setSubmitted] = useState<string>("");
  return (
    <form
      className="flex flex-col gap-4"
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
      {submitted ? <p>Submitted: {submitted}</p> : null}
    </form>
  );
}
