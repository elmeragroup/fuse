"use client";

import { Heading } from "@elmeragroup/fuse/heading";

const SIZES = ["default", "sm", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"] as const;

export function HeadingSizes() {
  return (
    <div className="flex flex-col gap-3">
      {SIZES.map((size) => (
        <Heading key={size} level={2} size={size}>
          {size}
        </Heading>
      ))}
    </div>
  );
}
