"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonDestructive() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Row deleted.</p>;
  }
  return (
    <ConfirmButton variant="destructive" armedChildren="Confirm delete" onConfirm={() => setConfirmed(true)}>
      Delete
    </ConfirmButton>
  );
}
