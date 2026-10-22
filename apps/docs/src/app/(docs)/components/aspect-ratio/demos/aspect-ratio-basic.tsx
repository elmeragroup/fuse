"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioBasic() {
  return (
    <AspectRatio ratio="16:9" className="max-w-md w-full">
      <img
        className="size-full rounded-lg object-cover"
        src="/demos/photos/grass-at-sunset.webp"
        alt="Tall grass against a low sun"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
