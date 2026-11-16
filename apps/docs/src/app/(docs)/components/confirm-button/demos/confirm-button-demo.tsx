"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonDemo() {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return <p>Invoice sent.</p>;
  }
  return (
    <ConfirmButton armedChildren="Confirm send" onConfirm={() => setConfirmed(true)}>
      Send invoice
    </ConfirmButton>
  );
}
