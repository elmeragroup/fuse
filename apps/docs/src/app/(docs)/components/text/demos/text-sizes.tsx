"use client";

import { Text } from "@elmeragroup/fuse/text";

const SIZES = ["xs", "sm", "default", "lg", "xl", "2xl"] as const;

export function TextSizes() {
  return (
    <div className="flex flex-col gap-3">
      {SIZES.map((size) => (
        <Text key={size} size={size}>
          {size}: March usage is <strong>1 240 kWh</strong> across two meters.
        </Text>
      ))}
    </div>
  );
}
