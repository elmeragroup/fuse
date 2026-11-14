"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioTwoThree() {
  return (
    <AspectRatio ratio="2:3" className="w-full max-w-52">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/stairwell.webp"
        alt="Two people talking on a stairwell, seen from above"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
