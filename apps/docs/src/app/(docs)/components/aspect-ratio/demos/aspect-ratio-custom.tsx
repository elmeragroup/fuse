"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioCustom() {
  return (
    <AspectRatio ratio="4:3" className="max-w-sm aspect-[7/5] w-full">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/meeting.webp"
        alt="Two colleagues talking at a desk"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
