"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";

export function ButtonVisuallyDisabled() {
  const [explanation, setExplanation] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button
        isVisuallyDisabled
        onClick={() => {
          setExplanation("This account is locked, so delete stays visible but explains itself.");
        }}>
        Delete account
      </Button>
      {explanation === null ? null : <p>{explanation}</p>}
    </div>
  );
}
