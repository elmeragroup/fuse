"use client";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonPending() {
  return (
    <ConfirmButton isPending onConfirm={() => undefined}>
      Sending
    </ConfirmButton>
  );
}
