"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldDemo() {
  return (
    <TextareaField
      label="Delivery notes"
      description="Shown to the driver."
      placeholder="Leave the parcel by the door."
    />
  );
}
