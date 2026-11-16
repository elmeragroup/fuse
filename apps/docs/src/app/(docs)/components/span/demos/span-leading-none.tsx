"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanLeadingNone() {
  return (
    <p className="max-w-xs">
      Invoice 10041{" "}
      <Span leading="none">
        covers meter 735999123 for March, settled on 3 April with the spot price and the fixed markup
      </Span>
      .
    </p>
  );
}
