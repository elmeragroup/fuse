"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioThreeTwo() {
  return (
    <AspectRatio ratio="3:2" className="max-w-sm w-full">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/coffee-break.webp"
        alt="A woman holding a coffee cup"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
