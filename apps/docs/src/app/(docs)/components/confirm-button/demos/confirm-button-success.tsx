"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonSuccess() {
  const [approved, setApproved] = useState(false);
  if (approved) {
    return <p>Request approved.</p>;
  }
  return (
    <ConfirmButton variant="success" onConfirm={() => setApproved(true)} armedChildren="Confirm approve">
      Approve
    </ConfirmButton>
  );
}
