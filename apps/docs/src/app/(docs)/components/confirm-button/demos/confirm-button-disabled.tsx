"use client";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";

export function ConfirmButtonDisabled() {
  return (
    <ConfirmButton disabled onConfirm={() => undefined}>
      Send invoice
    </ConfirmButton>
  );
}
