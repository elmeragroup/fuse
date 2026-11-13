"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonSecondary() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Draft discarded.</p>;
  }
  return (
    <ConfirmButton variant="secondary" armedChildren="Confirm discard" onConfirm={() => setConfirmed(true)}>
      Discard draft
    </ConfirmButton>
  );
}
