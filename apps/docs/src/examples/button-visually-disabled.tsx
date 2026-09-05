"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/ui/button";

export function ButtonVisuallyDisabled(): ReactElement {
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
