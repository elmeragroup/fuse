"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";
import { Trash } from "@elmeragroup/fuse/icons";

export function ConfirmButtonIconLarge() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Invoice deleted.</p>;
  }
  return (
    <ConfirmButton
      size="icon-lg"
      aria-label="Delete invoice"
      armedAriaLabel="Confirm delete invoice"
      onConfirm={() => setConfirmed(true)}>
      <Trash />
    </ConfirmButton>
  );
}
