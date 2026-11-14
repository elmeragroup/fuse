"use client";

import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";

export function SkeletonRevealPlainChildren() {
  return (
    <div className="max-w-sm w-full">
      <SkeletonReveal loading label="Loading meter">
        <section className="flex flex-col gap-1 rounded-lg border p-4">
          <h4 className="font-medium">Meter 7070575000</h4>
          <p className="text-sm text-muted-foreground">Last read on 1 October 2026.</p>
        </section>
      </SkeletonReveal>
    </div>
  );
}
