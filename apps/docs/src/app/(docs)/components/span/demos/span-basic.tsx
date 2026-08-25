"use client";

import { Span } from "@elmeragroup/ui/span";
import { Text } from "@elmeragroup/ui/text";

export function SpanBasic() {
  return (
    <Text>
      Invoice <Span>10041</Span> covers meters <Span>735999123</Span> and <Span>735999124</Span>.
    </Text>
  );
}
