"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";

export function AspectRatioBasic() {
  return (
    <AspectRatio ratio="16:9" className="max-w-md w-full">
      <img
        className="size-full rounded-lg object-cover"
        src="/landing/sites/fkas/renovated.webp"
        alt="Two people looking up at the beams of an attic under renovation"
        loading="lazy"
        decoding="async"
      />
    </AspectRatio>
  );
}
