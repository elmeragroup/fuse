"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";
import { X } from "@elmeragroup/fuse/icons";

export function ConfirmButtonIconExtraSmall() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Filter removed.</p>;
  }
  return (
    <ConfirmButton
      size="icon-xs"
      variant="ghost"
      aria-label="Remove filter"
      armedAriaLabel="Confirm remove filter"
      onConfirm={() => setConfirmed(true)}>
      <X />
    </ConfirmButton>
  );
}
