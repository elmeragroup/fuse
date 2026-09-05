"use client";

import { Span } from "@elmeragroup/ui/span";
import { Text } from "@elmeragroup/ui/text";

export function SpanVariants() {
  return (
    <div className="flex flex-col gap-2">
      <Text>
        Page <Span variant="muted">4 of 12</Span>
      </Text>
      <Text>
        Order 10041 <Span variant="success">delivered</Span>
      </Text>
      <Text>
        Order 10044 <Span variant="destructive">cancelled</Span>
      </Text>
    </div>
  );
}
