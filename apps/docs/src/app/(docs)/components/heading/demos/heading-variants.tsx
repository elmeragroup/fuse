"use client";

import { Heading } from "@elmeragroup/fuse/heading";

const VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
] as const;

export function HeadingVariants() {
  return (
    <div className="rounded-lg bg-card p-6 text-card-foreground">
      <div className="flex flex-col gap-3">
        {VARIANTS.map((variant) => (
          <Heading key={variant} variant={variant}>
            {variant}
          </Heading>
        ))}
      </div>
    </div>
  );
}
