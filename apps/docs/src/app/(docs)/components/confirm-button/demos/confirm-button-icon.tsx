"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";
import { Trash } from "@elmeragroup/fuse/icons";

export function ConfirmButtonIcon() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Row deleted.</p>;
  }
  return (
    <ConfirmButton
      variant="destructive"
      size="icon"
      aria-label="Delete"
      armedAriaLabel="Confirm delete"
      onConfirm={() => setConfirmed(true)}>
      <Trash />
    </ConfirmButton>
  );
}
