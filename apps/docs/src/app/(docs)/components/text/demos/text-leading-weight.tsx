"use client";

import { Text } from "@elmeragroup/ui/text";

const LEADINGS = ["none", "tight", "snug", "relaxed", "loose"] as const;
const WEIGHTS = ["normal", "medium", "bold"] as const;

export function TextLeadingWeight() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {LEADINGS.map((leading) => (
          <Text key={leading} leading={leading}>
            {leading}: Estimated consumption for the period is 1 240 kWh across two meters, settled 3 April.
          </Text>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {WEIGHTS.map((weight) => (
          <Text key={weight} weight={weight}>
            {weight}: March usage — bold maps to medium.
          </Text>
        ))}
      </div>
    </div>
  );
}
