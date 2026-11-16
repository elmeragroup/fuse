"use client";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonVisuallyDisabled() {
  return (
    <ConfirmButton isVisuallyDisabled onConfirm={() => undefined}>
      Send invoice
    </ConfirmButton>
  );
}
