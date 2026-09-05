"use client";

import type { ReactElement } from "react";

import { ScrollArea } from "@elmeragroup/ui/scroll-area";

const PHOTOS = ["Harbor", "Ridge", "Fjord", "Valley", "Coast", "Forest"];

export function ScrollAreaHorizontal(): ReactElement {
  return (
    <ScrollArea.Root orientation="horizontal" className="w-96 rounded-md border whitespace-nowrap">
      <div className="flex w-max gap-4 p-4">
        {PHOTOS.map((photo) => (
          <figure key={photo} className="w-40 shrink-0">
            <div className="h-32 rounded-md bg-muted" />
            <figcaption className="text-sm pt-2">{photo}</figcaption>
          </figure>
        ))}
      </div>
    </ScrollArea.Root>
  );
}
