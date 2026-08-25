"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/ui/confirm-button";
import { Trash } from "@elmeragroup/ui/icons";

export function ConfirmButtonIcon() {
  const [deleted, setDeleted] = useState(false);
  if (deleted) {
    return <p>Row removed.</p>;
  }
  return (
    <ConfirmButton
      variant="destructive"
      size="icon"
      aria-label="Delete"
      armedAriaLabel="Confirm delete"
      onConfirm={() => setDeleted(true)}>
      <Trash />
    </ConfirmButton>
  );
}
