"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/ui/confirm-button";

export function ConfirmButtonDestructive() {
  const [deleted, setDeleted] = useState(false);
  if (deleted) {
    return <p>Row removed.</p>;
  }
  return (
    <ConfirmButton variant="destructive" onConfirm={() => setDeleted(true)} armedChildren="Confirm delete">
      Delete
    </ConfirmButton>
  );
}
