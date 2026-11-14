"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanPrimary() {
  return (
    <p>
      Invoice <Span variant="primary">10041</Span> is due on 12 April.
    </p>
  );
}
