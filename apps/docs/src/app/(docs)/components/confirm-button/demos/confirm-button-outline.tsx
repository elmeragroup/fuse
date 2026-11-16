"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonOutline() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Filters reset.</p>;
  }
  return (
    <ConfirmButton variant="outline" armedChildren="Confirm reset" onConfirm={() => setConfirmed(true)}>
      Reset filters
    </ConfirmButton>
  );
}
