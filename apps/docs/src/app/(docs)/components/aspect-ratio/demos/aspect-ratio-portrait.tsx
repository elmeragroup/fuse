"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioPortrait() {
  return (
    <AspectRatio ratio="3:4" className="w-full max-w-60">
      <img
        className="size-full rounded-lg object-cover"
        src="/landing/sites/fkse/market.webp"
        alt="A woman smelling a branch of cherry blossom"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
