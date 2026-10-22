"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioPortrait() {
  return (
    <AspectRatio ratio="3:4" className="w-full max-w-60">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/snowy-forest.webp"
        alt="A snowy forest seen from above"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
