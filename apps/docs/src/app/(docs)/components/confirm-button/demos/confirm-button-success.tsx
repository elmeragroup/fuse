"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonSuccess() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Request approved.</p>;
  }
  return (
    <ConfirmButton variant="success" armedChildren="Confirm approve" onConfirm={() => setConfirmed(true)}>
      Approve
    </ConfirmButton>
  );
}
