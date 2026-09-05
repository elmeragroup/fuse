"use client";

import { useState } from "react";

import { TextareaField } from "@elmeragroup/ui/textarea-field";

export function TextareaFieldCounter() {
  const [value, setValue] = useState("");
  return (
    <TextareaField
      label="Bio"
      description="120 characters max."
      maxLength={120}
      value={value}
      onChange={setValue}
    />
  );
}
