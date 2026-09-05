"use client";

import { Loader } from "@elmeragroup/ui/loader";

const SIZES = ["default", "small", "medium", "large", "xl"] as const;

export function LoaderSizes() {
  return (
    <div className="flex items-center">
      {SIZES.map((size) => (
        <Loader key={size} size={size} aria-label="Laster" />
      ))}
    </div>
  );
}
