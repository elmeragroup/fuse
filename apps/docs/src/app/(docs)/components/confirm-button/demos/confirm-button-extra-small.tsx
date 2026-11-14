"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonExtraSmall() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Tag removed.</p>;
  }
  return (
    <ConfirmButton size="xs" armedChildren="Confirm remove" onConfirm={() => setConfirmed(true)}>
      Remove tag
    </ConfirmButton>
  );
}
