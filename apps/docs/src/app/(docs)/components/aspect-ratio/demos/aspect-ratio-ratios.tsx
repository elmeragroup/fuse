"use client";

import { AspectRatio } from "@elmeragroup/fuse/aspect-ratio";
import type { AspectRatioValue } from "@elmeragroup/fuse/aspect-ratio";

const RATIOS: readonly AspectRatioValue[] = ["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16"];

export function AspectRatioRatios() {
  return (
    <div className="max-w-xl grid w-full grid-cols-4 items-start gap-4">
      {RATIOS.map((ratio) => (
        <AspectRatio key={ratio} ratio={ratio}>
          <div className="text-sm font-medium flex size-full items-center justify-center rounded-md bg-muted text-muted-foreground tabular-nums">
            {ratio}
          </div>
        </AspectRatio>
      ))}
    </div>
  );
}
