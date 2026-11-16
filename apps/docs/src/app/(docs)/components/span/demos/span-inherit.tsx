"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanInherit() {
  return (
    <p className="text-primary">
      Invoice <Span variant="inherit">10041</Span> is due on 12 April.
    </p>
  );
}
