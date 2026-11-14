"use client";

import { Span } from "@elmeragroup/fuse/span";

export function SpanJustify() {
  return (
    <div className="max-w-xs flex w-full flex-col">
      <Span align="justify">
        Invoice 10041 covers meter 735999123 for March, settled on 3 April with the spot price and the fixed
        markup.
      </Span>
    </div>
  );
}
