"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";

export function ButtonVisuallyDisabled() {
  const [explanation, setExplanation] = useState("");

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        isVisuallyDisabled
        onClick={() => setExplanation("Add a payment method before you upgrade your plan.")}>
        Upgrade plan
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {explanation}
      </p>
    </div>
  );
}
