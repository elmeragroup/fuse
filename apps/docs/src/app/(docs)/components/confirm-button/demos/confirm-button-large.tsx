"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonLarge() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Subscription cancelled.</p>;
  }
  return (
    <ConfirmButton size="lg" armedChildren="Confirm cancel" onConfirm={() => setConfirmed(true)}>
      Cancel subscription
    </ConfirmButton>
  );
}
