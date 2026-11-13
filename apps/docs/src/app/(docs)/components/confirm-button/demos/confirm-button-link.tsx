"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonLink() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Photo removed.</p>;
  }
  return (
    <ConfirmButton variant="link" armedChildren="Confirm remove" onConfirm={() => setConfirmed(true)}>
      Remove photo
    </ConfirmButton>
  );
}
