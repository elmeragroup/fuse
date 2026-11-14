"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanTruncate() {
  return (
    <div className="flex max-w-40">
      <Span truncate title="customer-735999123-settlement-march-estimated.csv">
        customer-735999123-settlement-march-estimated.csv
      </Span>
    </div>
  );
}
