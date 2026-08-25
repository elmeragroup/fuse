"use client";

import { Text } from "@elmeragroup/ui/text";

export function TextTruncate() {
  return (
    <div className="w-48">
      <Text truncate title="Estimated consumption for the period is 1 240 kWh across two meters.">
        Estimated consumption for the period is 1 240 kWh across two meters.
      </Text>
    </div>
  );
}
