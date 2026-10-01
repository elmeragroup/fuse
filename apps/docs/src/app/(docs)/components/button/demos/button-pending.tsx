"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FloppyDisk, SpinnerGap } from "@elmeragroup/fuse/icons";

/**
 * A brand wordmark as SVGR leaves it: intrinsic width and height, no viewBox, so it keeps
 * its own size with `size-auto` instead of the recipe's 16px icon rule.
 */
function Wordmark() {
  return (
    <svg aria-hidden className="size-auto" width="56" height="14" xmlns="http://www.w3.org/2000/svg">
      <rect width="14" height="14" rx="3" fill="currentColor" />
      <rect x="18" y="3" width="38" height="8" rx="4" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function usePendingFor(ms: number): [boolean, () => void] {
  const [isPending, setIsPending] = useState(false);
  useEffect(() => {
    if (!isPending) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsPending(false);
    }, ms);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isPending, ms]);
  return [
    isPending,
    () => {
      setIsPending(true);
    },
  ];
}

export function ButtonPending() {
  const [isSaving, save] = usePendingFor(1800);
  const [isSigningIn, signIn] = usePendingFor(1800);

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button isPending={isSaving} onClick={save}>
          <FloppyDisk data-icon="inline-start" />
          {isSaving ? "Saving" : "Save"}
        </Button>
        <Button isPending variant="outline">
          Loading
        </Button>
        <Button isPending size="icon" variant="outline" aria-label="Refreshing">
          <FloppyDisk />
        </Button>
      </div>
      {/* A brand button owns its pending state: no built-in indicator, the content stays in
          flow and fades, and the spinner is centred over it, so the width and the accessible
          name hold. The overlay carries no data-icon, which would tighten an inset. */}
      <Button
        isPending={isSigningIn}
        pendingIndicator={null}
        variant="outline"
        className="relative"
        onClick={signIn}>
        <span className="inline-flex items-center gap-2 group-data-pending/button:opacity-0">
          <Wordmark />
          Continue with Brand
        </span>
        <SpinnerGap
          aria-hidden
          className="animate-spin absolute inset-0 m-auto hidden group-data-pending/button:block"
        />
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {isSaving ? "Saving your changes…" : isSigningIn ? "Opening Brand…" : "Idle."}
      </p>
    </div>
  );
}
