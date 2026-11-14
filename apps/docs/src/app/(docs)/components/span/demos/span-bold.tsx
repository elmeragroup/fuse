"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanBold() {
  return (
    <p>
      Invoice <Span weight="bold">10041</Span> is due on 12 April.
    </p>
  );
}
