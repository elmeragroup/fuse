"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonGhost() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Signed out.</p>;
  }
  return (
    <ConfirmButton variant="ghost" armedChildren="Confirm sign out" onConfirm={() => setConfirmed(true)}>
      Sign out
    </ConfirmButton>
  );
}
