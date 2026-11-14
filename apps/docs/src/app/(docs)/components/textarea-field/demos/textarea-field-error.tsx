"use client";

import { TextareaField } from "@elmeragroup/fuse/textarea-field";

export function TextareaFieldError() {
  return (
    <TextareaField
      label="Delivery notes"
      defaultValue="Leave it."
      isInvalid
      errorMessage="Say where the driver should leave the parcel."
    />
  );
}
