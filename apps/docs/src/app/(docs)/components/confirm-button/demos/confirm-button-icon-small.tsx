"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";
import { SignOut } from "@elmeragroup/fuse/icons";

export function ConfirmButtonIconSmall() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Signed out.</p>;
  }
  return (
    <ConfirmButton
      size="icon-sm"
      variant="outline"
      aria-label="Sign out"
      armedAriaLabel="Confirm sign out"
      onConfirm={() => setConfirmed(true)}>
      <SignOut />
    </ConfirmButton>
  );
}
