"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanMedium() {
  return (
    <p>
      Invoice <Span weight="medium">10041</Span> is due on 12 April.
    </p>
  );
}
