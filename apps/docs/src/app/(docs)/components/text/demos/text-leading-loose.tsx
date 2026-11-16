"use client";

import { Text } from "@elmeragroup/fuse/text";

export function TextLeadingLoose() {
  return (
    <div className="max-w-xs">
      <Text leading="loose">
        Estimated consumption for March is 1 240 kWh across two meters, settled on 3 April and billed with the
        spot price and the fixed markup.
      </Text>
    </div>
  );
}
