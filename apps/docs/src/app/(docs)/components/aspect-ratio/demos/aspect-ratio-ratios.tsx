"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";
import type { AspectRatioValue } from "@elmeragroup/fuse/aspect-ratio";

const RATIOS: readonly AspectRatioValue[] = ["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16"];

export function AspectRatioRatios() {
  return (
    <div className="max-w-xl grid w-full grid-cols-4 items-start gap-4">
      {RATIOS.map((ratio) => (
        <figure key={ratio}>
          <AspectRatio ratio={ratio}>
            <img
              className="size-full rounded-md object-cover"
              src="/demos/photos/wood-waves.webp"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </AspectRatio>
          <figcaption className="text-sm pt-2 text-muted-foreground tabular-nums">{ratio}</figcaption>
        </figure>
      ))}
    </div>
  );
}
