"use client";

import { useState } from "react";

import { ConfirmButton } from "@elmeragroup/fuse/confirm-button";
import { X } from "@elmeragroup/fuse/icons";

export function ConfirmButtonIconInline() {
  const [removed, setRemoved] = useState(false);
  return (
    <p className="text-sm">
      {removed ? "No discount code" : "Discount code SUMMER10"}
      {removed ? null : (
        <ConfirmButton
          size="icon-inline"
          variant="ghost"
          aria-label="Remove discount code"
          armedAriaLabel="Confirm remove discount code"
          onConfirm={() => setRemoved(true)}>
          <X />
        </ConfirmButton>
      )}
    </p>
  );
}
