"use client";

import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";

export function SkeletonRevealMarkers() {
  return (
    <div className="max-w-sm w-full">
      <SkeletonReveal loading label="Loading meter">
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          {/* Drawn as one block rather than a bar per line. */}
          <div data-skeleton="block" className="flex flex-col gap-1">
            <h4 className="font-medium">Meter 7070575000</h4>
            <p className="text-sm text-muted-foreground">Last read on 1 October 2026.</p>
          </div>
          {/* Left out of the skeleton: it stays as it is. */}
          <p data-skeleton="ignore" className="text-sm">
            Readings update every hour.
          </p>
        </section>
      </SkeletonReveal>
    </div>
  );
}
