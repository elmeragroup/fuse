"use client";

import { Span } from "@elmeragroup/ui/span";

const SIZES = ["xs", "sm", "default", "lg", "xl", "2xl"] as const;

export function SpanSizes() {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      {SIZES.map((size) => (
        <Span key={size} size={size}>
          {size}
        </Span>
      ))}
    </p>
  );
}
