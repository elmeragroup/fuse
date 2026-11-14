"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanSuccess() {
  return (
    <p>
      Invoice <Span variant="success">10041</Span> is due on 12 April.
    </p>
  );
}
