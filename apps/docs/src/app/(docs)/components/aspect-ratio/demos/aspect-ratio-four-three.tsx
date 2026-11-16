"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioFourThree() {
  return (
    <AspectRatio ratio="4:3" className="max-w-sm w-full">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/ocean.webp"
        alt="Green ocean water seen from above"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
