"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FloppyDisk } from "@elmeragroup/fuse/icons";

export function ButtonPending() {
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isPending) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsPending(false);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isPending]);

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          isPending={isPending}
          onClick={() => {
            setIsPending(true);
          }}>
          <FloppyDisk data-icon="inline-start" />
          {isPending ? "Saving" : "Save"}
        </Button>
        <Button isPending variant="outline">
          Loading
        </Button>
        <Button isPending size="icon" variant="outline" aria-label="Refreshing">
          <FloppyDisk />
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {isPending ? "Saving your changes…" : "Saved."}
      </p>
    </div>
  );
}
