"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanDestructive() {
  return (
    <p>
      Invoice <Span variant="destructive">10041</Span> is due on 12 April.
    </p>
  );
}
