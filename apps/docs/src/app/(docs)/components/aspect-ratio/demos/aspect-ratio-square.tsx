"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioSquare() {
  return (
    <AspectRatio ratio="1:1" className="w-full max-w-60">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/leaf.webp"
        alt="Raindrops on a green leaf"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
