"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonSmall() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>History cleared.</p>;
  }
  return (
    <ConfirmButton size="sm" armedChildren="Confirm clear" onConfirm={() => setConfirmed(true)}>
      Clear history
    </ConfirmButton>
  );
}
