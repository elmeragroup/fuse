"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanMuted() {
  return (
    <p>
      Invoice <Span variant="muted">10041</Span> is due on 12 April.
    </p>
  );
}
