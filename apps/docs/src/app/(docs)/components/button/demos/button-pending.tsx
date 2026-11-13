"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FloppyDisk } from "@elmeragroup/fuse/icons";

export function ButtonPending() {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isSaving) return;
    const timer = window.setTimeout(() => setIsSaving(false), 1800);
    return () => window.clearTimeout(timer);
  }, [isSaving]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button isPending={isSaving} onClick={() => setIsSaving(true)}>
        <FloppyDisk data-icon="inline-start" />
        <span>{isSaving ? "Saving" : "Save changes"}</span>
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {isSaving ? "Saving your changes…" : ""}
      </p>
    </div>
  );
}
