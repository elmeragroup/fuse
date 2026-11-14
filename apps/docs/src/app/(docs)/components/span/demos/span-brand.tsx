"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanBrand() {
  return (
    <p>
      Invoice <Span variant="brand">10041</Span> is due on 12 April.
    </p>
  );
}
