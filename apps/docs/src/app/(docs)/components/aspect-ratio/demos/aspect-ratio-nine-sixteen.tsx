"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioNineSixteen() {
  return (
    <AspectRatio ratio="9:16" className="w-full max-w-44">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/wood-waves.webp"
        alt="Layers of thin wood in waves"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
