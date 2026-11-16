"use client";

import { Text } from "@elmeragroup/fuse/text";

export function TextRight() {
  return (
    <div className="max-w-md w-full">
      <Text align="right">
        Estimated consumption for March is 1 240 kWh across two meters, settled on 3 April and billed with the
        spot price and the fixed markup.
      </Text>
    </div>
  );
}
